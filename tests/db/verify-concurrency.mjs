// J-003: real PostgreSQL 17, independent connections, synthetic disposable data.
// Never accepts a Supabase URL/key or a production database. No deployed E2E claim.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const LOCK = 8823001;
const VERSION = 'KB-2026-10-04-900';
const OPERATOR = 'PG-SYNTHETIC-OPERATOR';
const args = process.argv.slice(2);
const wrongMutex = args.length === 1 && args[0] === '--negative-control=wrong-publish-lock';
const oldWithdrawalOrder = args.length === 1 && args[0] === '--negative-control=old-withdraw-lock-order';
const negative = wrongMutex || oldWithdrawalOrder;
const result = [];
const clients = [];
let observer, holder, worker, observerPid, holderPid, workerPid;
let holding = false;
const record = (id, detail) => { result.push({ id, status: 'PASS' }); console.log(`PASS ${id} ${detail}`); };
const rpc = async (db, name, payload) => {
  assert.ok(['publish_knowledge_version', 'withdraw_knowledge_version', 'admin_publish_knowledge_version',
    'admin_withdraw_knowledge_version', 'upsert_content_pack', 'create_lead_with_idempotency',
    'request_session_deletion', 'withdraw_consent', 'run_deletion_cleanup', 'create_assessment_authorized', 'create_recommendation_authorized'].includes(name));
  return (await db.query(`select public.${name}($1::jsonb) as result`, [JSON.stringify(payload)])).rows[0].result;
};
const cliPublish = (recordIds = ['PG-RECORD-1'], versionId = VERSION) => ({ versionId, recordIds, createdBy: OPERATOR, approvedBy: OPERATOR });
const cliWithdraw = () => ({ reason: 'synthetic concurrency rehearsal', withdrawnBy: OPERATOR, republishVersionId: null });
const adminWithdraw = (auditId) => ({ withdrawVersionId: VERSION, republishVersionId: null,
  reason: 'synthetic concurrency rehearsal', operatorId: OPERATOR, auditId,
  now: new Date().toISOString(), today: new Date().toISOString().slice(0, 10) });
const plan = async () => (await observer.query('select public.compute_publish_plan() as plan')).rows[0].plan;
const adminPublish = async (auditId) => { const p = await plan(); assert.equal(p.canPublish, true);
  return { versionId: p.targetVersionId, previewToken: p.previewToken, operatorId: OPERATOR, auditId, now: new Date().toISOString() }; };

async function snapshot() {
  const state = {};
  for (const table of ['knowledge_versions', 'knowledge_records', 'knowledge_version_records', 'admin_audit_events']) {
    state[table] = (await observer.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows;
  }
  return state;
}

async function seedRecord(number, db = observer) {
  const id = `PG-RECORD-${number}`, packId = `PG-PACK-${number}`;
  await db.query(`insert into knowledge_records(id,source_id,title,category,jurisdiction,source_url,
    effective_from,effective_to,fetched_at,last_verified_at,content_hash,status,raw_text,summary,rule_data,
    created_at,updated_at,pack_id,pack_record_id,content_fingerprint)
    values($1,'PG-SOURCE',$2,'BENEFIT','TAIWAN','https://1966.gov.tw/','2020-01-01',null,
    now(),now(),'synthetic-source-hash','APPROVED','synthetic','synthetic','{}'::jsonb,now(),now(),$3,$1,$4)`,
  [id, `Synthetic record ${number}`, packId, `synthetic-content-fingerprint-${number}`]);
  await rpc(db, 'upsert_content_pack', { packId, intendedKnowledgeVersion: VERSION,
    formatVersion: '1.0', sourceRegistryVersion: 'SYNTHETIC', status: 'APPROVED',
    packFingerprint: `synthetic-pack-${number}`, recordsFingerprint: `synthetic-records-${number}`,
    reviewedBy: 'Synthetic reviewer', reviewedAt: new Date().toISOString(), reviewDecision: 'APPROVED',
    importedBy: OPERATOR, now: new Date().toISOString() });
}

async function reset() {
  await observer.query(`truncate admin_audit_events, admin_sessions, knowledge_record_review_events,
    content_packs, knowledge_version_records, knowledge_changes, knowledge_records, knowledge_versions,
    crawler_snapshots, crawler_runs, knowledge_sources, internal_operators cascade`);
  await observer.query(`insert into internal_operators(id,display_name,roles,key_hash,active,created_at)
    values($1,'Synthetic test operator',array['KNOWLEDGE_PUBLISHER'],'synthetic-not-a-key',true,now())`, [OPERATOR]);
  await observer.query(`insert into knowledge_sources(id,name,authority,jurisdiction,source_url,active,created_at,updated_at)
    values('PG-SOURCE','Synthetic source','MOHW','TAIWAN','https://1966.gov.tw/',true,now(),now())`);
  await seedRecord(1);
}

async function beginHolder() {
  await holder.query('begin'); holding = true;
  await holder.query('select pg_advisory_xact_lock($1)', [LOCK]);
}
async function releaseHolder(commit = false) {
  if (holding) { await holder.query(commit ? 'commit' : 'rollback'); holding = false; }
}

async function blockedOperation(operation) {
  const handle = { done: false };
  // Attach rejection handling immediately; failed RPCs are expected in stale-state cases.
  handle.pending = operation(worker).then(value => {
    handle.done = true; return { ok: true, value };
  }, error => { handle.done = true; return { ok: false, code: error.code, message: error.message }; });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !handle.done) {
    const { rows: [locks] } = await observer.query(`select
      exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) as waiting,
      pg_blocking_pids($1) as blockers`, [workerPid]);
    if (locks.waiting && locks.blockers.includes(holderPid)) return handle;
    await delay(20);
  }
  await releaseHolder();
  await handle.pending;
  throw Object.assign(new Error('RPC did not wait for the other connection holding the shared knowledge lock'),
    { code: 'SHARED_LOCK_NOT_OBSERVED' });
}

async function lockCase(id, name, withdrawal = false) {
  await reset();
  if (withdrawal) await rpc(observer, 'publish_knowledge_version', cliPublish());
  const payload = name === 'publish_knowledge_version' ? cliPublish()
    : name === 'withdraw_knowledge_version' ? cliWithdraw()
      : name === 'admin_publish_knowledge_version' ? await adminPublish(`PG-AUDIT-${id}`) : adminWithdraw(`PG-AUDIT-${id}`);
  const before = await snapshot();
  await beginHolder();
  try {
    const handle = await blockedOperation(db => rpc(db, name, payload));
    assert.deepEqual(await snapshot(), before, 'no writes or success audit before the shared lock is released');
    await releaseHolder();
    const outcome = await handle.pending;
    assert.equal(outcome.ok, true, 'RPC should succeed after releasing the holder');
    const { rows: versions } = await observer.query("select id from knowledge_versions where status='PUBLISHED'");
    assert.equal(versions.length, withdrawal ? 0 : 1);
    const audits = (await observer.query('select count(*)::int n from admin_audit_events')).rows[0].n;
    assert.equal(audits, name.startsWith('admin_') ? 1 : 0);
    record(id, `${name}: observed advisory waiter blocked by a distinct backend; writes follow release`);
  } finally { await releaseHolder(); }
}

async function stalePublish() {
  await reset();
  const payload = await adminPublish('PG-AUDIT-STALE-PUBLISH');
  await beginHolder();
  try {
    const handle = await blockedOperation(db => rpc(db, 'admin_publish_knowledge_version', payload));
    await seedRecord(2, holder); // another approved candidate changes the confirmed plan before lock release.
    await releaseHolder(true);
    const afterOtherWriter = await snapshot();
    const outcome = await handle.pending;
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /^STATE_CHANGED:/);
    assert.deepEqual(await snapshot(), afterOtherWriter, 'stale request leaves no version/membership/audit changes');
    record('PG-C1', 'queued admin publish recomputes after the other transaction commits; stale preview rejected without writes');
  } finally { await releaseHolder(); }
}

async function staleWithdrawal() {
  await reset(); await rpc(observer, 'publish_knowledge_version', cliPublish());
  await seedRecord(2);
  await beginHolder();
  try {
    const handle = await blockedOperation(db => rpc(db, 'admin_withdraw_knowledge_version', adminWithdraw('PG-AUDIT-STALE-WITHDRAW')));
    await rpc(holder, 'publish_knowledge_version', cliPublish(['PG-RECORD-2'], 'KB-2026-10-04-901'));
    await releaseHolder(true);
    const committed = await snapshot();
    const outcome = await handle.pending;
    assert.equal(outcome.ok, false); assert.match(outcome.message, /^STATE_CHANGED:/);
    assert.deepEqual(await snapshot(), committed);
    record('PG-C2', 'queued withdrawal rechecks current version after concurrent CLI publish; newer version and audit state preserved');
  } finally { await releaseHolder(); }
}

async function twoPublishers() {
  await reset();
  const first = await adminPublish('PG-AUDIT-FIRST'), second = await adminPublish('PG-AUDIT-SECOND');
  await holder.query('begin'); holding = true;
  try {
    await rpc(holder, 'admin_publish_knowledge_version', first); // holds lock until COMMIT.
    const handle = await blockedOperation(db => rpc(db, 'admin_publish_knowledge_version', second));
    await releaseHolder(true);
    const committed = await snapshot();
    const outcome = await handle.pending;
    assert.equal(outcome.ok, false); // no approved records remain, so existing SQL returns VALIDATION_ERROR.
    assert.match(outcome.message, /^(VALIDATION_ERROR|STATE_CHANGED):/);
    assert.deepEqual(await snapshot(), committed);
    assert.equal((await observer.query('select count(*)::int n from admin_audit_events')).rows[0].n, 1);
    assert.equal((await observer.query("select count(*)::int n from knowledge_versions where status='PUBLISHED'")).rows[0].n, 1);
    record('PG-C3', 'two actual admin publishers serialize; only one publication and one success audit committed');
  } finally { await releaseHolder(); }
}

async function seedLead() {
  await observer.query('truncate sessions,providers cascade');
  const now = new Date().toISOString();
  // Supply synthetic values for required columns; real constraints and RPCs remain active.
  const rows = [
    ['sessions',{id:'PG-S',status:'ACTIVE',token_hash:'synthetic-hash',expires_at:'2035-01-01T00:00:00Z'}],
    ['consents',{id:'PG-C',session_id:'PG-S',withdrawn_at:null}],
    ['providers',{id:'PG-P'}],['providers',{id:'PG-P2'}],
    ['assessments',{id:'PG-A',session_id:'PG-S',status:'COMPLETED'}],
    ['recommendation_runs',{id:'PG-R',assessment_id:'PG-A',service_type:'HOME_CARE'}],
    ['recommendation_items',{id:'PG-I',recommendation_run_id:'PG-R',provider_id:'PG-P',rank:1}],
    ['recommendation_items',{id:'PG-I2',recommendation_run_id:'PG-R',provider_id:'PG-P2',rank:2}],
  ];
  for (const [table,row] of rows) {
    assert.match(table,/^[a-z_]+$/);
    const cols = (await observer.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null",[table])).rows;
    for (const {column_name:c,data_type:t} of cols) if (!(c in row)) row[c] = /timestamp|date/.test(t) ? now
      : /int|numeric|double|real/.test(t) ? 0 : t==='boolean' ? false : ['json','jsonb','ARRAY'].includes(t) ? '{}' : 'SYNTHETIC';
    const keys=Object.keys(row); for (const k of keys) assert.match(k,/^[a-z_]+$/);
    await observer.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));
  }
}
const leadPayload = (id='PG-LEAD-1',key='11111111-1111-1111-1111-111111111111',provider='PG-P') => ({
  id,sessionId:'PG-S',assessmentId:'PG-A',recommendationId:'PG-R',providerId:provider,serviceType:'HOME_CARE',
  contactName:'Synthetic',contactPhone:'0900000000',contactConsentAt:new Date().toISOString(),
  createdAt:new Date().toISOString(),idempotencyKey:key,requestFingerprint:'synthetic-'+provider,
  consentId:'PG-C',sessionTokenHash:'synthetic-hash',
});
const leadCounts = async () => (await observer.query('select (select count(*)::int from leads) leads,(select count(*)::int from lead_idempotency_records) ledger')).rows[0];
async function blockedSessionOperation(operation) {
  const h={done:false};
  h.pending=operation(worker).then(value=>{h.done=true;return {ok:true,value};},error=>{h.done=true;return {ok:false,message:error.message};});
  const deadline=Date.now()+5000;
  while (Date.now()<deadline && !h.done) {
    const row=(await observer.query("select pg_blocking_pids($1) blockers,(select wait_event_type from pg_stat_activity where pid=$1) wait",[workerPid])).rows[0];
    if (row.wait==='Lock' && row.blockers.includes(holderPid)) return h;
    await delay(20);
  }
  await releaseHolder(); await h.pending;
  throw Object.assign(new Error('Session transaction lock not observed'),{code:'SESSION_LOCK_NOT_OBSERVED'});
}
async function leadConcurrency() {
  for (const name of ['request_session_deletion','withdraw_consent']) {
    await seedLead();await holder.query('begin');holding=true;
    try {
      await rpc(holder,name,{sessionId:'PG-S',now:new Date().toISOString()});
      const h=await blockedSessionOperation(c=>rpc(c,'create_lead_with_idempotency',leadPayload()));
      await releaseHolder(true);const out=await h.pending;
      assert.equal(out.ok,false);assert.match(out.message,/^SESSION_INVALID:/);
      assert.deepEqual(await leadCounts(),{leads:0,ledger:0});
      record('PG-LEAD-'+name,'withdrawal/deletion wins the Session lock; queued creation rejects without contacts');
    } finally {await releaseHolder();}
  }
  for (const sameKey of [true,false]) {
    await seedLead();await holder.query('begin');holding=true;
    try {
      const first=await rpc(holder,'create_lead_with_idempotency',leadPayload());
      const second=leadPayload('PG-LEAD-2',sameKey?'11111111-1111-1111-1111-111111111111':'22222222-2222-2222-2222-222222222222',sameKey?'PG-P2':'PG-P');
      const h=await blockedSessionOperation(c=>rpc(c,'create_lead_with_idempotency',second));
      await releaseHolder(true);const out=await h.pending;
      if(sameKey){assert.equal(out.ok,false);assert.match(out.message,/^IDEMPOTENCY_CONFLICT:/);}
      else {assert.equal(out.ok,true);assert.equal(out.value.leadId,first.leadId);assert.equal(out.value.duplicate,true);}
      assert.deepEqual(await leadCounts(),{leads:1,ledger:sameKey?1:2});
      record('PG-LEAD-'+(sameKey?'same-key':'business-duplicate'),'two actual connections serialize; no unclaimed Lead remains');
    } finally {await releaseHolder();}
  }
  for (const name of ['request_session_deletion','withdraw_consent']) {
    await seedLead();await holder.query('begin');holding=true;
    try {
      await rpc(holder,'create_lead_with_idempotency',leadPayload());
      const h=await blockedSessionOperation(c=>rpc(c,name,{sessionId:'PG-S',now:new Date().toISOString()}));
      await releaseHolder(true);const out=await h.pending;assert.equal(out.ok,true);
      const lead=(await observer.query('select status,contact_name,contact_phone from leads')).rows[0];
      assert.deepEqual(lead,{status:'CANCELLED',contact_name:null,contact_phone:null});
      assert.deepEqual(await leadCounts(),{leads:1,ledger:1});
      record('PG-LEAD-create-before-'+name,'creation wins; queued withdrawal/deletion cancels and clears newly committed contacts');
    } finally {await releaseHolder();}
  }
}

async function cleanupWhileSessionResumes() {
  await seedLead();
  await observer.query("update sessions set created_at=now()-interval '120 days',last_seen_at=now()-interval '100 days' where id='PG-S'");
  await holder.query('begin');holding=true;
  try {
    await holder.query("update sessions set last_seen_at=now() where id='PG-S'");
    const h=await blockedSessionOperation(c=>rpc(c,'run_deletion_cleanup',{now:new Date().toISOString(),dryRun:false}));
    await releaseHolder(true);const out=await h.pending;assert.equal(out.ok,true);
    assert.equal(out.value.sessionsDeleted,0,'cleanup must recheck expiry after a concurrent last_seen_at touch');
    const session=(await observer.query("select status from sessions where id='PG-S'")).rows[0];
    assert.equal(session.status,'ACTIVE');
    assert.equal((await observer.query("select count(*)::int n from assessments where session_id='PG-S'")).rows[0].n,1);
    assert.equal((await observer.query("select count(*)::int n from recommendation_items")).rows[0].n,2);
    record('PG-CLEANUP-RESUMED','cleanup waits for Session and rechecks retention eligibility; resumed Session/health remains');
  } finally {await releaseHolder();}
}

async function cleanupWithdrawalLockOrder() {
  await seedLead();
  await observer.query("update sessions set created_at=now()-interval '120 days',last_seen_at=now()-interval '100 days';update consents set accepted_at=now()-interval '4 years'");
  // A synthetic trigger pauses the actual withdrawal RPC at Consent UPDATE. The
  // lock ordering itself is production SQL; no replacement business function.
  await observer.query(`create function zz_pause_consent_update() returns trigger language plpgsql as $$
    begin perform pg_advisory_xact_lock(991100);return new;end $$;
    create trigger zz_pause_consent_update before update on consents for each row execute function zz_pause_consent_update()`);
  await holder.query('begin');holding=true;await holder.query('select pg_advisory_xact_lock(991100)');
  const settled=promise=>promise.then(value=>({ok:true,value}),error=>({ok:false,code:error.code}));
  let withdrawal,cleanup;
  try {
    withdrawal=settled(rpc(worker,'withdraw_consent',{sessionId:'PG-S',now:new Date().toISOString()}));
    let seen=false;
    for (let i=0;i<200;i++) {
      const locks=(await holder.query('select pg_blocking_pids($1) blockers',[workerPid])).rows[0];
      if (locks.blockers.includes(holderPid)) {seen=true;break;}await delay(20);
    }
    assert.equal(seen,true,'actual withdrawal paused in its Consent UPDATE');
    cleanup=settled(rpc(observer,'run_deletion_cleanup',{now:new Date().toISOString(),dryRun:false}));
    seen=false;
    for (let i=0;i<200;i++) {
      const locks=(await holder.query('select pg_blocking_pids($1) blockers',[observerPid])).rows[0];
      if (locks.blockers.includes(workerPid)) {seen=true;break;}await delay(20);
    }
    assert.equal(seen,true,'actual cleanup is queued behind the withdrawal');
    await releaseHolder(true);
    const [w,c]=await Promise.all([withdrawal,cleanup]);
    if ([w,c].some(out=>!out.ok && out.code==='40P01')) throw Object.assign(new Error('Actual inverse-lock deadlock observed'),{code:'DEADLOCK_OBSERVED'});
    assert.equal(w.ok,true,'withdrawal must not deadlock');assert.equal(c.ok,true,'cleanup must not deadlock');
    assert.equal(w.value.updated,true);assert.equal(c.value.sessionsDeleted,1);assert.equal(c.value.consentsDeleted,1);
    assert.equal((await observer.query("select status from sessions where id='PG-S'")).rows[0].status,'DELETED');
    assert.equal((await observer.query('select count(*)::int n from assessments')).rows[0].n,0);
    record('PG-CLEANUP-WITHDRAW-ORDER','actual withdrawal paused at Consent UPDATE; cleanup waits, both complete without inverse-lock deadlock');
  } finally {
    await releaseHolder();await Promise.allSettled([withdrawal,cleanup].filter(Boolean));
    await observer.query('drop trigger zz_pause_consent_update on consents;drop function zz_pause_consent_update()');
  }
}

async function healthPayload(kind) {
  const security={sessionId:'PG-S',sessionTokenHash:'synthetic-hash'};
  if(kind==='assessment') {
    const a=(await observer.query("select to_jsonb(a) row from assessments a where id='PG-A'")).rows[0].row;
    return {...security,assessment:{...a,id:'PG-A2',rules_version:'SYNTHETIC',rule_trace:{}},care_need_profile:{id:'PG-CNP',assessment_id:'PG-A2',care_needs:[],priority:[],warnings:[],summary:'synthetic',created_at:new Date().toISOString()}};
  }
  const run=(await observer.query("select to_jsonb(r) row from recommendation_runs r where id='PG-R'")).rows[0].row;
  return {...security,run:{...run,id:'PG-R2'},items:[]};
}
async function healthWriteConcurrency() {
  for(const kind of ['assessment','recommendation']) {
    for(const name of ['request_session_deletion','withdraw_consent']) {
      await seedLead();const payload=await healthPayload(kind);await holder.query('begin');holding=true;
      try {
        await rpc(holder,name,{sessionId:'PG-S',now:new Date().toISOString()});
        const h=await blockedSessionOperation(c=>rpc(c,`create_${kind}_authorized`,payload));
        await releaseHolder(true);const out=await h.pending;
        assert.equal(out.ok,false);assert.match(out.message,/^SESSION_INVALID:/);
        assert.equal((await observer.query('select count(*)::int n from assessments')).rows[0].n,1);
        assert.equal((await observer.query('select count(*)::int n from recommendation_runs')).rows[0].n,1);
        assert.equal((await observer.query('select count(*)::int n from care_need_profiles')).rows[0].n,0);
        record(`PG-HEALTH-${kind}-${name}`,'deletion/withdrawal wins; queued health write rejects with no new health rows');
      } finally {await releaseHolder();}
    }
    await seedLead();const payload=await healthPayload(kind);await holder.query('begin');holding=true;
    try {
      await rpc(holder,`create_${kind}_authorized`,payload);
      const h=await blockedSessionOperation(c=>rpc(c,'request_session_deletion',{sessionId:'PG-S',now:new Date().toISOString()}));
      await releaseHolder(true);const out=await h.pending;assert.equal(out.ok,true);
      await rpc(observer,'run_deletion_cleanup',{now:new Date().toISOString(),dryRun:false});
      for(const table of ['assessments','care_need_profiles','recommendation_runs','recommendation_items']) assert.equal((await observer.query(`select count(*)::int n from ${table}`)).rows[0].n,0);
      record(`PG-HEALTH-${kind}-before-deletion`,'health write wins; queued deletion and subsequent real cleanup remove all associated health rows');
    } finally {await releaseHolder();}
  }
}

try {
  if (args.length && !negative) throw new Error('Unsupported arguments');
  const url = new URL(process.env.KAREO_TEST_PG_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.search !== '' || url.hash !== ''
      || url.pathname !== '/kareo_concurrency_test' || url.username !== 'kareo_test'
      || process.env.KAREO_TEST_PG_DISPOSABLE !== '1') throw Object.assign(new Error('Explicit disposable local test database configuration required'), { code: 'CONFIG_REJECTED' });
  for (let i = 0; i < 3; i++) {
    const db = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
    clients.push(db); await db.connect();
  }
  [observer, holder, worker] = clients;
  const server = (await observer.query("select current_database() db, current_user usr, current_setting('server_version_num')::int version")).rows[0];
  assert.equal(server.db, 'kareo_concurrency_test'); assert.equal(server.usr, 'kareo_test');
  assert.ok(server.version >= 170000 && server.version < 180000, 'PostgreSQL 17 required');
  const pids = await Promise.all(clients.map(async c => (await c.query('select pg_backend_pid() pid')).rows[0].pid));
  assert.equal(new Set(pids).size, 3, 'three genuinely distinct PostgreSQL backends required');
  [observerPid, holderPid, workerPid] = pids;
  await observer.query('drop schema public cascade; create schema public');
  await observer.query(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$`);
  const dir = 'apps/api/supabase/migrations';
  const files = readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
  for (const file of files) await observer.query(readFileSync(join(dir, file), 'utf8'));
  record('PG-M1', `PostgreSQL ${server.version}; ${files.length} actual repository migrations, three independent connections`);
  if (wrongMutex) {
    const definition = (await observer.query("select pg_get_functiondef('public.publish_knowledge_version(jsonb)'::regprocedure) definition")).rows[0].definition;
    assert.ok(definition.includes('pg_advisory_xact_lock(8823001)'));
    await observer.query(definition.replace('pg_advisory_xact_lock(8823001)', 'pg_advisory_xact_lock(8823002)'));
  }
  if (oldWithdrawalOrder) {
    const original=readFileSync(join(dir,'0021_security_acceptance.sql'),'utf8');
    const start=original.indexOf('create or replace function public.withdraw_consent(payload jsonb)');
    assert.ok(start>=0);const end=original.indexOf('$$;',start)+3;
    await observer.query(original.slice(start,end));
    await cleanupWithdrawalLockOrder();
  } else await lockCase('PG-L1', 'publish_knowledge_version');
  if (!negative) {
    await lockCase('PG-L2', 'withdraw_knowledge_version', true);
    await lockCase('PG-L3', 'admin_publish_knowledge_version');
    await lockCase('PG-L4', 'admin_withdraw_knowledge_version', true);
    await stalePublish(); await staleWithdrawal(); await twoPublishers();
    await leadConcurrency();
    await cleanupWhileSessionResumes();
    await cleanupWithdrawalLockOrder();
    await healthWriteConcurrency();
  }
} catch (error) {
  // All data is synthetic, nevertheless avoid echoing connection URLs or arbitrary SQL exceptions.
  console.error(`FAIL PG-CONCURRENCY ${['SHARED_LOCK_NOT_OBSERVED', 'SESSION_LOCK_NOT_OBSERVED', 'DEADLOCK_OBSERVED', 'CONFIG_REJECTED'].includes(error.code) ? error.code
    : error instanceof assert.AssertionError ? error.message : 'setup or RPC behaviour failed'}`);
  process.exitCode = 1;
} finally {
  await releaseHolder().catch(() => {});
  await Promise.allSettled(clients.map(c => c.end()));
  console.log(`Summary: ${result.length} PASS; ${process.exitCode ? 'FAIL' : 'PASS'}; isolated PostgreSQL only, not deployment E2E`);
}
