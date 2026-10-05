import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

let db:PGlite;
const keyHash=createHash('sha256').update('LOCAL-ONLY-PRIVACY-KEY').digest('hex');
const rpc=async(q:Record<string,unknown>)=>(await db.query<{r:Record<string,unknown>}>('select process_privacy_right($1::jsonb) r',[JSON.stringify(q)])).rows[0].r;
const base=(id:string,action='EXPORT',extra:Record<string,unknown>={})=>({requestId:'PRQ-'+id,action,sessionId:'SES-'+id,operatorId:'OP-PRIVACY',operatorKeyHash:keyHash,receivedAt:new Date(Date.now()-10000).toISOString(),verifiedAt:new Date().toISOString(),verificationMethod:'ORIGINAL_CONTACT_CONFIRMED',verificationRef:'CASE-LOCAL-001',...extra});
const row=async(table:string,data:Record<string,unknown>)=>{
 const cols=(await db.query<{column_name:string;data_type:string}>(`select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null`,[table])).rows;
 const q={...data}; for(const {column_name:c,data_type:t} of cols) if(!(c in q))q[c]=/timestamp|date/.test(t)?new Date().toISOString():/int|numeric|double|real/.test(t)?0:t==='boolean'?false:t==='jsonb'||t==='json'?'{}':t==='ARRAY'?'{}':'LOCAL';
 const ks=Object.keys(q);await db.query(`insert into ${table}(${ks.join(',')}) values(${ks.map((_,i)=>'$'+(i+1)).join(',')})`,ks.map(k=>q[k]));
};
async function seed(id:string){
 await row('sessions',{id:'SES-'+id,status:'ACTIVE',token_hash:'PRIVATE-TOKEN-HASH-'+id});
 await row('consents',{id:'CON-'+id,session_id:'SES-'+id,withdrawn_at:null});
 await row('assessments',{id:'ASM-'+id,session_id:'SES-'+id,free_text:'SYNTHETIC-PRIVATE-HEALTH',knowledge_version:'KB-LOCAL'});
 await row('care_need_profiles',{id:'CNP-'+id,assessment_id:'ASM-'+id});
 await row('providers',{id:'P-'+id});
 await row('recommendation_runs',{id:'R-'+id,assessment_id:'ASM-'+id,service_type:'HOME_CARE'});
 await row('recommendation_items',{id:'RI-'+id,recommendation_run_id:'R-'+id,provider_id:'P-'+id,rank:1});
 await row('leads',{id:'L-'+id,session_id:'SES-'+id,assessment_id:'ASM-'+id,recommendation_id:'R-'+id,provider_id:'P-'+id,service_type:'HOME_CARE',status:'NEW',contact_name:'合成甲',contact_phone:'0900000000',idempotency_key:'PRIVATE-IDEMPOTENCY'});
}
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');
 const directory=resolve('supabase/migrations');for(const f of readdirSync(directory).filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(resolve(directory,f),'utf8'));
 await row('internal_operators',{id:'OP-PRIVACY',display_name:'Local',roles:['DATA_STEWARD'],key_hash:keyHash,active:true,revoked_at:null});
 await row('knowledge_versions',{id:'KB-LOCAL',status:'PUBLISHED'});
 await seed('OTHER');
},30000);
afterAll(async()=>{await db.close();});

describe('protected privacy SQL operations',()=>{
 it('denies public reads and execution for both visitor roles',async()=>{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await expect(db.query('select * from privacy_operations')).rejects.toThrow('permission denied');await expect(rpc(base('PUBLIC'))).rejects.toThrow('permission denied');await db.exec('reset role');}
 });
 it('wrong key, wrong role, revoked operator and missing identity proof change nothing',async()=>{
  await seed('AUTH');const q=base('AUTH');await expect(rpc({...q,operatorKeyHash:'forged'})).rejects.toThrow('PRIVACY_UNAUTHORIZED');
  await expect(rpc({...q,verificationMethod:'KNOWS_LEAD_ID'})).rejects.toThrow('PRIVACY_VERIFICATION_REQUIRED');
  await expect(rpc({...q,verificationRef:null})).rejects.toThrow('PRIVACY_VERIFICATION_REQUIRED');
  await expect(rpc({...q,verificationMethod:'AUTHORIZED_PROXY_CONFIRMED'})).rejects.toThrow('PRIVACY_VERIFICATION_REQUIRED');
  await expect(rpc({...q,verifiedAt:'2020-01-01'})).rejects.toThrow('PRIVACY_VERIFICATION_REQUIRED');
  await db.exec("update internal_operators set roles=array['LEAD_OPERATOR'] where id='OP-PRIVACY'");await expect(rpc(q)).rejects.toThrow('PRIVACY_UNAUTHORIZED');
  await db.exec("update internal_operators set roles=array['DATA_STEWARD'],revoked_at=now() where id='OP-PRIVACY'");await expect(rpc(q)).rejects.toThrow('PRIVACY_UNAUTHORIZED');
  await db.exec("update internal_operators set revoked_at=null where id='OP-PRIVACY'");
  expect((await db.query('select * from privacy_operations')).rows.length).toBe(0);
 });
 it('exact export excludes credential fields and other sessions, with transactional audit',async()=>{
  await seed('EXPORT');const r=await rpc(base('EXPORT'));const raw=JSON.stringify(r);
  expect(raw).not.toContain('SES-OTHER');expect(raw).not.toContain('PRIVATE-TOKEN-HASH');expect(raw).not.toContain('token_hash');expect(raw).not.toContain('PRIVATE-IDEMPOTENCY');expect(raw).toContain('SYNTHETIC-PRIVATE-HEALTH');
  const audit=(await db.query("select * from privacy_operations where request_id='PRQ-EXPORT'")).rows[0];expect(JSON.stringify(audit)).not.toContain('SYNTHETIC-PRIVATE-HEALTH');expect(JSON.stringify(audit)).not.toContain('0900000000');
 });
 it('rejects cross-target Lead/session and reusing a request reference',async()=>{
  await seed('REUSE');await rpc(base('REUSE'));
  await expect(rpc(base('OTHER','DELETE',{leadId:'L-REUSE'}))).rejects.toThrow('PRIVACY_TARGET_MISMATCH');
  await expect(rpc(base('REUSE','DELETE'))).rejects.toThrow('PRIVACY_REQUEST_ALREADY_USED');
  expect((await db.query("select status from sessions where id='SES-REUSE'")).rows[0].status).toBe('ACTIVE');
 });
 it('contact correction binds the row revision and changes only that Lead',async()=>{
  await seed('CONTACT');const q=base('CONTACT','CORRECT_CONTACT',{leadId:'L-CONTACT',contactName:'合成乙',contactPhone:'0900000001'});
  await expect(rpc({...q,expectedUpdatedAt:'2020-01-01'})).rejects.toThrow('PRIVACY_STATE_CHANGED');
  const updated=(await db.query("select updated_at from leads where id='L-CONTACT'")).rows[0].updated_at;
  await rpc({...q,expectedUpdatedAt:updated});expect((await db.query("select contact_name from leads where id='L-CONTACT'")).rows[0].contact_name).toBe('合成乙');
  expect((await db.query("select contact_name from leads where id='L-OTHER'")).rows[0].contact_name).toBe('合成甲');
 });
 it('can correct retained closed-case contact but cannot recreate an erased contact',async()=>{
  await seed('CLOSED');await db.exec("update leads set status='CLOSED' where id='L-CLOSED';update sessions set status='DELETED' where id='SES-CLOSED'");
  const updated=(await db.query("select updated_at from leads where id='L-CLOSED'")).rows[0].updated_at;
  await rpc(base('CLOSED','CORRECT_CONTACT',{leadId:'L-CLOSED',expectedUpdatedAt:updated,contactName:'合成更正',contactPhone:'0900000001'}));
  await db.exec("update leads set contact_name=null,contact_phone=null where id='L-CLOSED'");
  await expect(rpc(base('CLOSED','CORRECT_CONTACT',{requestId:'PRQ-CLOSED-AGAIN',leadId:'L-CLOSED',expectedUpdatedAt:updated,contactName:'合成更正',contactPhone:'0900000001'}))).rejects.toThrow('PRIVACY_STATE_CHANGED');
  expect((await db.query("select contact_phone from leads where id='L-CLOSED'")).rows[0].contact_phone).toBeNull();
 });
 it('corrected health/profile, stale recommendation removal and outreach stop commit together',async()=>{
  await seed('CORRECT');const updated=(await db.query("select updated_at from assessments where id='ASM-CORRECT'")).rows[0].updated_at;
  const assessment={sessionId:'SES-CORRECT',ageRange:'65_74',location:{city:null,district:null,precision:'NONE',lat:null,lng:null},livingSituation:'ALONE',caregiverSituation:'NO_CAREGIVER',mobilityLevel:'INDEPENDENT',dailyLivingLevel:'INDEPENDENT',disabilityCertificate:'NO',incomeCategory:'GENERAL',needs:{homeCare:'NO',medicalNursing:'NO',assistiveDevice:'YES',transportation:'NO'},freeText:'合成更正',knowledgeVersion:'KB-LOCAL',rulesVersion:'RULES-LOCAL',ruleTrace:{}};
  const q=base('CORRECT','CORRECT_ASSESSMENT',{assessmentId:'ASM-CORRECT',expectedUpdatedAt:updated,assessment,profile:{careNeeds:['ASSISTIVE_DEVICE'],priority:['ASSISTIVE_DEVICE'],summary:'合成新結果',warnings:[]}});
  await expect(rpc({...q,assessment:{...assessment,knowledgeVersion:'KB-NO-PUBLICATION'}})).rejects.toThrow('PRIVACY_STATE_CHANGED');
  await rpc(q);expect((await db.query("select free_text from assessments where id='ASM-CORRECT'")).rows[0].free_text).toBe('合成更正');expect((await db.query("select summary from care_need_profiles where assessment_id='ASM-CORRECT'")).rows[0].summary).toBe('合成新結果');
  expect((await db.query("select * from recommendation_runs where assessment_id='ASM-CORRECT'")).rows).toHaveLength(0);
  const l=(await db.query("select status,status_reason,contact_phone from leads where id='L-CORRECT'")).rows[0];expect(l).toEqual({status:'CANCELLED',status_reason:'DATA_CORRECTED',contact_phone:null});
 });
 it('audit failure rolls back a contact mutation and no raw value enters error',async()=>{
  await seed('ROLLBACK');const updated=(await db.query("select updated_at from leads where id='L-ROLLBACK'")).rows[0].updated_at;
  await db.exec("create function privacy_test_fail() returns trigger language plpgsql as $$ begin if new.request_id='PRQ-ROLLBACK' then raise exception 'SYNTHETIC_AUDIT_FAILURE'; end if; return new; end $$;create trigger privacy_fail before insert on privacy_operations for each row execute function privacy_test_fail();");
  await expect(rpc(base('ROLLBACK','CORRECT_CONTACT',{leadId:'L-ROLLBACK',expectedUpdatedAt:updated,contactName:'合成乙',contactPhone:'0900000001'}))).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');
  expect((await db.query("select contact_name from leads where id='L-ROLLBACK'")).rows[0].contact_name).toBe('合成甲');
  await db.exec('drop trigger privacy_fail on privacy_operations;drop function privacy_test_fail();');
 });
 it('lost-token stop and delete invalidate their exact session and clear contacts',async()=>{
  for(const action of ['STOP','DELETE']){await seed(action);await rpc(base(action,action));const r=(await db.query('select status from sessions where id=$1',['SES-'+action])).rows[0];expect(r.status).toBe('DELETION_REQUESTED');expect((await db.query('select contact_phone from leads where session_id=$1',['SES-'+action])).rows[0].contact_phone).toBeNull();}
  expect((await db.query("select status from sessions where id='SES-OTHER'")).rows[0].status).toBe('ACTIVE');
 });
 it('recorded successful cleanup prunes expired minimal rights audits and dry-run does not',async()=>{
  await row('privacy_operations',{request_id:'PRQ-EXPIRED',operator_id:'OP-PRIVACY',session_id:'SES-OTHER',action:'EXPORT',received_at:'2020-01-01',verified_at:'2020-01-01',verification_method:'ORIGINAL_CONTACT_CONFIRMED',verification_ref:'CASE-EXPIRED',created_at:'2020-01-01',result_counts:'{}'});
  const payload={runId:'DRUN-PRIVACY-PRUNE',operatorId:'OP-PRIVACY',now:new Date().toISOString(),dryRun:true};
  await db.query('select run_deletion_cleanup_recorded($1::jsonb)',[JSON.stringify(payload)]);
  expect((await db.query("select request_id from privacy_operations where request_id='PRQ-EXPIRED'")).rows).toHaveLength(1);
  await db.query('select run_deletion_cleanup_recorded($1::jsonb)',[JSON.stringify({...payload,dryRun:false})]);
  expect((await db.query("select request_id from privacy_operations where request_id='PRQ-EXPIRED'")).rows).toHaveLength(0);
  expect((await db.query("select request_id from privacy_operations where request_id='PRQ-EXPORT'")).rows).toHaveLength(1);
 });

});
