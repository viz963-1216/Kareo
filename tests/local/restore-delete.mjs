// Synthetic application-data restore and deletion replay. No cloud/physical restore.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { restoreApplicationSnapshot } from '../../scripts/restore-app-snapshot.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

export async function captureSyntheticSnapshot(db) {
  const tables = {};
  const { rows } = await db.query("select tablename from pg_tables where schemaname='public' order by tablename");
  for (const { tablename } of rows) {
    if (!/^[a-z][a-z_]*$/.test(tablename)) throw new Error('Invalid snapshot table');
    tables[tablename] = (await db.query(`select to_jsonb(t) as row from public."${tablename}" t`)).rows.map(r => r.row);
  }
  // Caller is the guarded disposable local HTTP stack. Never persist raw rows.
  return { format:'kareo-app-snapshot-v1', projectRef:'LOCAL-SYNTHETIC', schemaThrough:'0027', tables };
}

export async function restoreAndReplaySyntheticDeletion(snapshot, receipt, operatorId) {
  if (snapshot.projectRef !== 'LOCAL-SYNTHETIC' || operatorId !== 'LOCAL-SYNTHETIC-OPERATOR'
      || !['CONSENT_WITHDRAWN','USER_DELETED'].includes(receipt.action)
      || typeof receipt.sessionId !== 'string' || !Number.isFinite(Date.parse(receipt.requestedAt))) {
    throw new Error('Synthetic restore replay metadata required');
  }
  const require = createRequire(resolve(root,'tests/db/package.json'));
  const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
  const db = new PGlite();
  try {
    const restored = await restoreApplicationSnapshot(db, snapshot, resolve(root,'apps/api/supabase/migrations'));
    assert.equal(restored.status,'PASS','Restored application snapshot must match every typed row');
    const sid = receipt.sessionId;
    const readHealth = async () => (await db.query(`select
      (select count(*)::int from assessments where session_id=$1) assessments,
      (select count(*)::int from care_need_profiles where assessment_id in (select id from assessments where session_id=$1)) profiles,
      (select count(*)::int from recommendation_runs where assessment_id in (select id from assessments where session_id=$1)) runs,
      (select count(*)::int from recommendation_items where recommendation_run_id in
        (select id from recommendation_runs where assessment_id in (select id from assessments where session_id=$1))) items`,[sid])).rows[0];
    const before = await readHealth();
    assert.ok(before.assessments > 0 && before.profiles > 0,'Negative control: restore alone revives old health data');
    const beforeLeads = (await db.query('select count(*)::int n from leads where session_id=$1 and contact_phone is not null',[sid])).rows[0].n;
    if (receipt.action === 'CONSENT_WITHDRAWN') assert.ok(beforeLeads > 0,'Negative control: pre-withdrawal backup still contains a contact');
    assert.equal((await db.query('select status from sessions where id=$1',[sid])).rows[0].status,'ACTIVE');
    const unrelatedBefore = (await db.query("select count(*)::int n from assessments a join sessions s on s.id=a.session_id where a.session_id <> $1 and s.status='ACTIVE'",[sid])).rows[0].n;
    const publishedBefore = (await db.query(`select count(*)::int n from knowledge_version_records m
      join knowledge_versions v on v.id=m.version_id where v.status='PUBLISHED'`)).rows[0].n;

    // Replay the synthetic receipt captured from the ACTUAL HTTP request after
    // this earlier snapshot. This is not a production durable deletion ledger.
    const rpc = receipt.action === 'CONSENT_WITHDRAWN' ? 'withdraw_consent' : 'request_session_deletion';
    const replay = (await db.query(`select public.${rpc}($1::jsonb) as result`,[JSON.stringify({sessionId:sid,now:receipt.requestedAt})])).rows[0].result;
    assert.ok(replay && (replay.updated === true || replay.sessionId === sid),'Actual deletion RPC must acknowledge request');
    const cleared = (await db.query('select status,status_reason,contact_name,contact_phone from leads where session_id=$1',[sid])).rows;
    assert.ok(cleared.every(r => r.status === 'CANCELLED' && r.status_reason === receipt.action && r.contact_name === null && r.contact_phone === null));
    if (receipt.action === 'CONSENT_WITHDRAWN') {
      assert.equal((await db.query('select count(*)::int n from consents where session_id=$1 and withdrawn_at is null',[sid])).rows[0].n,0);
    }
    const payload = {runId:'DRUN-LOCAL_RESTORE_'+receipt.action,operatorId,now:new Date().toISOString(),dryRun:false};
    const result = (await db.query('select public.run_deletion_cleanup_recorded($1::jsonb) as result',[JSON.stringify(payload)])).rows[0].result;
    assert.equal(result.status,'SUCCESS');
    assert.deepEqual(await readHealth(),{assessments:0,profiles:0,runs:0,items:0});
    assert.equal((await db.query('select status from sessions where id=$1',[sid])).rows[0].status,'DELETED');
    assert.equal((await db.query('select count(*)::int n from consents where session_id=$1',[sid])).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from assessments a join sessions s on s.id=a.session_id where a.session_id <> $1 and s.status='ACTIVE'",[sid])).rows[0].n,unrelatedBefore);
    assert.equal((await db.query(`select count(*)::int n from knowledge_version_records m
      join knowledge_versions v on v.id=m.version_id where v.status='PUBLISHED'`)).rows[0].n,publishedBefore);
    payload.runId += '_RETRY';
    const retry = (await db.query('select public.run_deletion_cleanup_recorded($1::jsonb) as result',[JSON.stringify(payload)])).rows[0].result;
    assert.equal(retry.sessionsDeleted,0);
    return {status:'PASS',kind:'synthetic-application-restore-and-deletion-replay',physicalBackupRestored:false,
      cloudWrites:0,action:receipt.action,tablesCompared:restored.tables.length,migrationsApplied:restored.migrationsApplied,
      negativeControl:{healthRestored:before.assessments,contactsRestored:beforeLeads},
      afterReplay:{healthRows:0,contacts:0,sessionStatus:'DELETED',consentEvidence:1},
      unrelatedActiveAssessmentsPreserved:true,publishedMembersPreserved:publishedBefore,retrySessionsDeleted:0,
      limitations:['In-memory PGlite application restore, not Supabase physical backup','Synthetic in-memory receipt; production independent deletion ledger remains to implement and verify']};
  } catch { throw new Error('Synthetic application restore or deletion replay failed; no cloud database modified'); }
  finally { await db.close(); }
}
