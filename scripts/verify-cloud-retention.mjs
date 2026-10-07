import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {rowsDigest as digest} from './backfill-acceptance.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const out=resolve('work/cloud-retention-evidence.json');
export function assertCloudTarget(env){
  assert.equal(env.KAREO_CLOUD_RETENTION_CONFIRM,'true');
  assert.equal(env.SUPABASE_URL,'https://ojawadobnaxduxybqolk.supabase.co');
  assert.equal(env.NETLIFY_SITE_ID,'faeb21e1-94d1-4d42-bbbc-6f9692caaef9');
  assert.equal(env.KAREO_OPERATOR_ID,'OP-SU-ZIJIE-ACCEPTANCE');
  for(const k of ['SUPABASE_SERVICE_ROLE_KEY','NETLIFY_AUTH_TOKEN','KAREO_OPERATOR_KEY'])assert.ok(typeof env[k]==='string'&&env[k].trim());
}
export async function main(){
const evidence={scope:'LOCAL_MODULES_WITH_REAL_ACCEPTANCE_SUPABASE_AND_NETLIFY_BLOBS_NOT_DEPLOYED_E2E',
  commit:process.env.GITHUB_SHA??'LOCAL_WORKTREE',projectRef:'ojawadobnaxduxybqolk',
  siteId:'faeb21e1-94d1-4d42-bbbc-6f9692caaef9',operatorId:'OP-SU-ZIJIE-ACCEPTANCE',
  executor:'Codex under explicit Jerry delegation',startedAt:new Date().toISOString(),checks:[]};
let stage='configuration';
const save=()=>{mkdirSync(resolve('work'),{recursive:true});writeFileSync(out,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});};
const pass=(name,details={})=>{evidence.checks.push({name,status:'PASS',...details});save();console.log('PROOF '+JSON.stringify({name,...details}));};
const mod=p=>import(root+'/apps/api/dist/'+p+'.js');
try {
  assertCloudTarget(process.env);
  const siteResponse=await fetch('https://api.netlify.com/api/v1/sites/'+evidence.siteId,{headers:{Authorization:'Bearer '+process.env.NETLIFY_AUTH_TOKEN},signal:AbortSignal.timeout(30000)});
  assert.equal(siteResponse.status,200);
  const site=await siteResponse.json();assert.equal(site.id,evidence.siteId);assert.equal(site.name,'kareo-tw');
  const [{getSupabaseClient},{SupabaseSessionRepository},{SupabaseLeadRepository},{SupabaseDeletionJournalRepository},
    {createDeletionJournal},{runCleanupCli},{requireOperator,hashOperatorKey},{createSession},{handler}]=await Promise.all([
      mod('repositories/supabaseClient'),mod('repositories/supabaseSessionRepository'),mod('repositories/supabaseLeadRepository'),
      mod('repositories/supabaseDeletionJournalRepository'),mod('privacy/netlifyDeletionJournal'),mod('scripts/cleanupExpiredData'),
      mod('services/internalOperatorService'),mod('services/sessionService'),mod('functions/session')]);
  const client=getSupabaseClient(),sessionRepo=new SupabaseSessionRepository(),operatorRepo=new SupabaseLeadRepository(),
    replayRepo=new SupabaseDeletionJournalRepository(),journal=createDeletionJournal();
  const rows=async table=>{const {data,error,count}=await client.from(table).select('*',{count:'exact'}).limit(1000);assert.equal(error,null);assert.equal(data.length,count);return data;};
  const count=async table=>{const {error,count}=await client.from(table).select('*',{head:true,count:'exact'});assert.equal(error,null);return count;};
  stage='personal-authorization';
  await requireOperator(operatorRepo,evidence.operatorId,process.env.KAREO_OPERATOR_KEY,'DATA_STEWARD');
  pass(stage);
  const before=await rows('sessions'),beforeHash=digest(before),baselineRuns=await count('deletion_runs');
  for(const table of ['assessments','leads','consents']) assert.equal(await count(table),0);
  assert.equal(before.filter(r=>r.status==='DELETION_REQUESTED'||(r.status==='ACTIVE'&&Date.parse(r.last_seen_at??r.created_at)<=Date.now()-90*86400000)).length,0);
  pass('no-preexisting-cleanup-candidates',{existingSessions:before.length,healthRows:0,leadRows:0,consentRows:0});
  stage='bad-operator-before-journal-io';
  let touched=false;
  const rejected=await runCleanupCli(['--dry-run','--operator-id',evidence.operatorId],{KAREO_OPERATOR_KEY:'SYNTHETIC-INVALID-KEY'},
    {sessionRepo,operatorRepo,journal:{projectRef:evidence.projectRef,readAll:async()=>{touched=true;throw Error();}},replayRepo,log:()=>{},error:()=>{}});
  assert.equal(rejected,1);assert.equal(touched,false);assert.equal(await count('deletion_runs'),baselineRuns);
  pass(stage);
  stage='create-disposable-no-health-session';
  const created=await createSession(sessionRepo);
  evidence.syntheticSessionId=created.id;save();
  const {data:original,error:readError}=await client.from('sessions').select('*').eq('id',created.id).single();assert.equal(readError,null);
  pass(stage,{created:1});
  stage='authenticated-delete-and-cloud-strong-read';
  const deleted=await handler({httpMethod:'DELETE',headers:{'x-kareo-session-token':created.sessionToken}});
  assert.equal(deleted.statusCode,200);assert.equal(JSON.parse(deleted.body).data.status,'DELETION_REQUESTED');
  const receipts=await journal.readAll(),receipt=receipts.find(r=>r.sessionId===created.id&&r.action==='USER_DELETED');
  assert.ok(receipt);assert.equal(receipt.projectRef,evidence.projectRef);
  const repeat=await journal.record(created.id,'USER_DELETED',new Date(Date.now()+1000).toISOString());
  assert.equal(repeat.requestedAt,receipt.requestedAt);
  assert.equal(JSON.parse(deleted.body).data.deletionScheduledBefore,new Date(Date.parse(receipt.requestedAt)+7*86400000).toISOString());
  pass(stage,{receiptFields:Object.keys(receipt).sort(),receipts:receipts.length,originalDeadlinePreserved:true});
  stage='deleted-token-rejected';
  const denied=await handler({httpMethod:'DELETE',headers:{'x-kareo-session-token':created.sessionToken}});
  assert.equal(denied.statusCode,401);assert.equal(JSON.parse(denied.body).error.code,'SESSION_INVALID');
  pass(stage);
  // Stop before a global cleanup if any other live target is introduced.
  const safeTargets=async()=>{
    const current=await rows('sessions');
    assert.equal(digest(current.filter(r=>r.id!==created.id)),beforeHash);
    const candidates=current.filter(r=>r.status==='DELETION_REQUESTED'||(r.status==='ACTIVE'&&Date.parse(r.last_seen_at??r.created_at)<=Date.now()-90*86400000));
    assert.equal(candidates.length,1);assert.equal(candidates[0].id,created.id);
    for(const r of await journal.readAll()) {
      const target=current.find(s=>s.id===r.sessionId);
      assert.ok(!target||target.id===created.id||target.status==='DELETED');
    }
    for(const table of ['assessments','leads','consents'])assert.equal(await count(table),0);
  };
  const deps={sessionRepo,operatorRepo,journal,replayRepo,log:()=>{},error:()=>{}};
  stage='protected-cloud-dry-run';await safeTargets();
  assert.equal(await runCleanupCli(['--dry-run','--operator-id',evidence.operatorId],process.env,deps),0);
  assert.equal(await count('deletion_runs'),baselineRuns);
  const dry=await sessionRepo.runDeletionCleanup({now:new Date().toISOString(),dryRun:true});
  assert.deepEqual(dry,{sessionsDeleted:1,leadsContactCleared:0,leadsDeleted:0,consentsDeleted:0});
  pass(stage,{sessionsToClean:1,noAuditWrite:true});
  stage='journal-failure-stops-cleanup';
  const failJournal={projectRef:evidence.projectRef,readAll:async()=>{throw Error('SYNTHETIC-READ-FAILURE');}};
  assert.equal(await runCleanupCli(['--commit','--operator-id',evidence.operatorId],process.env,{...deps,journal:failJournal}),1);
  assert.equal(await count('deletion_runs'),baselineRuns);await safeTargets();
  pass(stage,{fault:'LOCAL_INJECTED_READ_FAILURE_NOT_VENDOR_OUTAGE',noCleanup:true});
  stage='protected-cloud-commit';await safeTargets();
  assert.equal(await runCleanupCli(['--commit','--operator-id',evidence.operatorId],process.env,deps),0);
  let current=await rows('sessions');assert.equal(current.find(s=>s.id===created.id).status,'DELETED');
  assert.equal(digest(current.filter(r=>r.id!==created.id)),beforeHash);
  assert.equal(await count('deletion_runs'),baselineRuns+1);
  pass(stage,{syntheticSessionsCleaned:1,preexistingSessionsUnchanged:true});
  stage='synthetic-row-restore-only';
  // Restore only this script-created, no-health row. This is NOT a physical Supabase backup restore.
  const {error:restoreError}=await client.from('sessions').update({...original}).eq('id',created.id);assert.equal(restoreError,null);
  pass(stage,{restoredRows:1,physicalBackupRestore:false});
  stage='sql-replay-rechecks-operator';
  let badRejected=false;
  try{await replayRepo.replay({projectRef:evidence.projectRef,receipts:await journal.readAll(),operatorId:evidence.operatorId,operatorKeyHash:hashOperatorKey('SYNTHETIC-INVALID-KEY')});}catch{badRejected=true;}
  assert.equal(badRejected,true);assert.equal((await rows('sessions')).find(s=>s.id===created.id).status,'ACTIVE');
  pass(stage);
  stage='cloud-replay-and-cleanup-after-synthetic-restore';
  current=await rows('sessions');assert.equal(digest(current.filter(r=>r.id!==created.id)),beforeHash);
  for(const table of ['assessments','leads','consents'])assert.equal(await count(table),0);
  assert.equal(await runCleanupCli(['--commit','--operator-id',evidence.operatorId],process.env,deps),0);
  current=await rows('sessions');assert.equal(current.find(s=>s.id===created.id).status,'DELETED');
  assert.equal(digest(current.filter(r=>r.id!==created.id)),beforeHash);assert.equal(await count('deletion_runs'),baselineRuns+2);
  const audit=(await rows('deletion_runs')).filter(r=>Date.parse(r.started_at)>=Date.parse(evidence.startedAt));
  assert.equal(audit.length,2);assert.ok(audit.every(r=>r.status==='SUCCESS'&&!r.dry_run&&r.operator_id===evidence.operatorId&&r.sessions_deleted===1&&r.leads_deleted===0&&r.consents_deleted===0));
  pass(stage,{syntheticSessionsCleaned:1,successfulAudits:2,preexistingDigest:beforeHash});
  stage='final-privacy-baseline';
  for(const table of ['assessments','leads','consents'])assert.equal(await count(table),0);
  assert.equal((await journal.readAll()).find(r=>r.sessionId===created.id).requestedAt,receipt.requestedAt);
  pass(stage,{healthRows:0,leadRows:0,consentRows:0,finalSessionStatus:'DELETED'});
  evidence.finishedAt=new Date().toISOString();evidence.status='PASS';save();
}catch(error){
  evidence.status='STOPPED';evidence.failedStage=stage;evidence.finishedAt=new Date().toISOString();save();
  console.log('SAFE_FAILURE '+JSON.stringify({stage,errorClass:error?.name??'Error',httpStatus:typeof error?.statusCode==='number'?error.statusCode:undefined}));
  process.exitCode=1;
}

}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
