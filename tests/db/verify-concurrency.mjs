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
const negative = args.length === 1 && args[0] === '--negative-control=wrong-publish-lock';
const result = [];
const clients = [];
let observer, holder, worker, holderPid, workerPid;
let holding = false;
const record = (id, detail) => { result.push({ id, status: 'PASS' }); console.log(`PASS ${id} ${detail}`); };
const rpc = async (db, name, payload) => {
  assert.ok(['publish_knowledge_version', 'withdraw_knowledge_version', 'admin_publish_knowledge_version',
    'admin_withdraw_knowledge_version', 'upsert_content_pack'].includes(name));
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

try {
  if (args.length && !negative) throw new Error('Unsupported arguments');
  const url = new URL(process.env.KAREO_TEST_PG_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/kareo_concurrency_test' || url.username !== 'kareo_test'
      || process.env.KAREO_TEST_PG_DISPOSABLE !== '1') throw new Error('Explicit disposable local test database configuration required');
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
  [, holderPid, workerPid] = pids;
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
  if (negative) {
    const definition = (await observer.query("select pg_get_functiondef('public.publish_knowledge_version(jsonb)'::regprocedure) definition")).rows[0].definition;
    assert.ok(definition.includes('pg_advisory_xact_lock(8823001)'));
    await observer.query(definition.replace('pg_advisory_xact_lock(8823001)', 'pg_advisory_xact_lock(8823002)'));
  }
  await lockCase('PG-L1', 'publish_knowledge_version');
  if (!negative) {
    await lockCase('PG-L2', 'withdraw_knowledge_version', true);
    await lockCase('PG-L3', 'admin_publish_knowledge_version');
    await lockCase('PG-L4', 'admin_withdraw_knowledge_version', true);
    await stalePublish(); await staleWithdrawal(); await twoPublishers();
  }
} catch (error) {
  // All data is synthetic, nevertheless avoid echoing connection URLs or arbitrary SQL exceptions.
  console.error(`FAIL PG-CONCURRENCY ${error.code === 'SHARED_LOCK_NOT_OBSERVED' ? 'SHARED_LOCK_NOT_OBSERVED'
    : error instanceof assert.AssertionError ? error.message : 'setup or RPC behaviour failed'}`);
  process.exitCode = 1;
} finally {
  await releaseHolder().catch(() => {});
  await Promise.allSettled(clients.map(c => c.end()));
  console.log(`Summary: ${result.length} PASS; ${process.exitCode ? 'FAIL' : 'PASS'}; isolated PostgreSQL only, not deployment E2E`);
}
