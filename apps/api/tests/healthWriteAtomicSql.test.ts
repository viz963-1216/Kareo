// J-003: the real health-write services + all Supabase repositories, actual SQL in a disposable DB.
// The local SDK boundary supports only the query operations used by these repositories.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createAssessment } from '../src/services/assessmentService.js';
import { createRecommendation } from '../src/services/recommendationService.js';
import { RuleBasedAssessmentEngine } from '../src/assessment/ruleBasedAssessmentEngine.js';
import { fixtureSnapshot } from './fixtures/knowledgeFixture.js';
import { SupabaseProviderRepository } from '../src/repositories/supabaseProviderRepository.js';
import { SupabaseSessionRepository } from '../src/repositories/supabaseSessionRepository.js';
import { SupabaseConsentRepository } from '../src/repositories/supabaseConsentRepository.js';
import { SupabaseAssessmentRepository } from '../src/repositories/supabaseAssessmentRepository.js';
import { SupabaseRecommendationRepository } from '../src/repositories/supabaseRecommendationRepository.js';

let db: PGlite;
let beforeFinalWrite: (() => Promise<void>) | undefined;
const allowedTables = new Set(['sessions','consents','assessments','recommendation_runs','recommendation_items','leads','lead_idempotency_records']);
const safe = (s: string) => { if (!/^[a-z_]+$/.test(s)) throw new Error('Unsupported test identifier'); return s; };
const hook = async () => { const run = beforeFinalWrite; beforeFinalWrite = undefined; await run?.(); };
class Query {
  private columns = '*'; private filters: Array<{ column: string; value: unknown; kind: string }> = [];
  private ordering = ''; private count = ''; private single = false;
  private row: Record<string, unknown> | undefined; private mode = 'select';
  constructor(private table: string) { if (!allowedTables.has(table)) throw new Error('Unsupported test table'); }
  select(columns: string) { if (!/^[a-z_, *]+$/.test(columns)) throw new Error('Unsupported selection'); this.columns = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column: safe(column), value, kind: 'eq' }); return this; }
  is(column: string, value: null) { this.filters.push({ column: safe(column), value, kind: 'null' }); return this; }
  not(column: string, operator: string, value: string) { if (operator !== 'in' || value !== '(CLOSED,CANCELLED)') throw new Error('Unsupported test NOT'); this.filters.push({ column: safe(column), value: null, kind: 'open' }); return this; }
  order(column: string, opts: { ascending: boolean }) { this.ordering = ` order by ${safe(column)} ${opts.ascending ? 'asc' : 'desc'}`; return this; }
  limit(n: number) { if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid test limit'); this.count = ` limit ${n}`; return this; }
  maybeSingle() { this.single = true; return this; }
  insert(row: Record<string, unknown>) { this.row = row; this.mode = 'insert'; return this; }
  update(row: Record<string, unknown>) { this.row = row; this.mode = 'update'; return this; }
  async execute() {
    try {
      if (this.mode === 'insert') {
        if (this.table === 'leads') await hook();
        await db.query(`insert into public.${this.table} select * from jsonb_populate_record(null::public.${this.table},$1::jsonb)`,[JSON.stringify(this.row)]);
        return { data: null, error: null };
      }
      const params: unknown[] = []; const conditions = this.filters.map(f => {
        if (f.kind === 'null') return f.column+' is null';
        if (f.kind === 'open') return f.column+" not in ('CLOSED','CANCELLED')";
        params.push(f.value); return f.column+'=$'+params.length;
      });
      const where = conditions.length ? ' where '+conditions.join(' and ') : '';
      if (this.mode === 'update') {
        const entries = Object.entries(this.row ?? {}); const sets = entries.map(([column,value]) => { params.push(value); return safe(column)+'=$'+params.length; });
        await db.query(`update public.${this.table} set ${sets.join(',')}${where}`,params);
        return { data: null, error: null };
      }
      const { rows } = await db.query(`select ${this.columns} from public.${this.table}${where}${this.ordering}${this.count}`,params);
      const jsonRows = JSON.parse(JSON.stringify(rows)); // REST timestamp serialization, no SDK auth/JWT simulation.
      return { data: this.single ? jsonRows[0] ?? null : jsonRows, error: null };
    } catch (err) { return { data: null, error: { code: (err as { code?: string }).code, message: (err as Error).message } }; }
  }
  then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return this.execute().then(resolve,reject); }
}
vi.mock('../src/repositories/supabaseClient.js', () => ({ getSupabaseClient: () => ({
  from: (table: string) => new Query(table),
  rpc: async (fn: string, args: { payload: unknown }) => {
    if (!['create_assessment_with_profile','create_assessment_authorized','create_recommendation_result','create_recommendation_authorized'].includes(fn)) throw new Error('Unsupported test RPC');
    await hook();
    try { const r = await db.query<{ result: unknown }>(`select public.${fn}($1::jsonb) result`,[JSON.stringify(args.payload)]); return { data: r.rows[0].result, error: null }; }
    catch (err) { return { data: null, error: { code: (err as { code?: string }).code, message: (err as Error).message } }; }
  },
}) }));
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../supabase/migrations');
const TOKEN = 'synthetic-local-session-token';
const NOW = new Date().toISOString();
async function insert(table: string, values: Record<string, unknown>) {
  const { rows: cols } = await db.query<{column_name:string;data_type:string}>("select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null",[table]);
  const row = { ...values };
  for (const { column_name:c,data_type:t } of cols) if (!(c in row)) row[c] = /timestamp|date/.test(t) ? NOW : /int|numeric|double|real/.test(t) ? 0 : t==='boolean' ? false : ['json','jsonb','ARRAY'].includes(t) ? '{}' : 'SYNTHETIC';
  const keys=Object.keys(row);await db.query(`insert into ${safe(table)} (${keys.map(safe).join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));
}
beforeEach(async () => {
  db = new PGlite(); beforeFinalWrite = undefined;
  await db.exec('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');
  for (const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(dir,file),'utf8'));
  await insert('sessions',{id:'SYN-S',status:'ACTIVE',token_hash:createHash('sha256').update(TOKEN).digest('hex'),expires_at:'2035-01-01T00:00:00Z'});
  await insert('consents',{id:'SYN-C',session_id:'SYN-S',withdrawn_at:null});
  await insert('providers',{id:'SYN-P'});
  await insert('assessments',{id:'SYN-A',session_id:'SYN-S',status:'COMPLETED'});
  await insert('recommendation_runs',{id:'SYN-R',assessment_id:'SYN-A',service_type:'HOME_CARE'});
  await insert('recommendation_items',{id:'SYN-I',recommendation_run_id:'SYN-R',provider_id:'SYN-P',rank:1});
  await db.exec("update assessments set location_precision='NONE',city=null,district=null,lat=null,lng=null");
},30000);
afterEach(async () => { await db.close(); });


const assessmentBody=()=>({sessionId:'SYN-S',ageRange:'65_74',location:{city:null,district:null,precision:'NONE',lat:null,lng:null},livingSituation:'WITH_FAMILY',caregiverSituation:'FAMILY_LIMITED',mobilityLevel:'NEEDS_ASSISTANCE',dailyLivingLevel:'PARTIAL_ASSISTANCE',disabilityCertificate:'UNKNOWN',incomeCategory:'UNKNOWN',needs:{homeCare:'YES',medicalNursing:'UNKNOWN',assistiveDevice:'YES',transportation:'YES'},freeText:'synthetic'});
const assessmentDeps=()=>({sessionRepo:new SupabaseSessionRepository(),consentRepo:new SupabaseConsentRepository(),assessmentRepo:new SupabaseAssessmentRepository(),knowledgeResolver:{resolvePublishedKnowledge:async()=>fixtureSnapshot()},aiAdapter:new RuleBasedAssessmentEngine()});
const recommendationDeps=()=>({sessionRepo:new SupabaseSessionRepository(),assessmentRepo:new SupabaseAssessmentRepository(),recommendationRepo:new SupabaseRecommendationRepository(),providerRepo:new SupabaseProviderRepository()});
const healthCounts=async()=>(await db.query('select (select count(*)::int from assessments) assessments,(select count(*)::int from care_need_profiles) profiles,(select count(*)::int from recommendation_runs) runs,(select count(*)::int from recommendation_items) items')).rows[0];
describe('late health writes after Node authentication and consent checks',()=>{
  for(const name of ['request_session_deletion','withdraw_consent']) {
    it(`Assessment rejects when ${name} committed before the final write`,async()=>{
      beforeFinalWrite=async()=>{await db.query(`select public.${name}($1::jsonb)`,[JSON.stringify({sessionId:'SYN-S',now:new Date().toISOString()})]);};
      await expect(createAssessment(assessmentDeps(),assessmentBody(),TOKEN)).rejects.toMatchObject({code:'SESSION_INVALID'});
      expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:1,items:1});
    },20000);
    it(`Recommendation rejects when ${name} committed before the final write`,async()=>{
      beforeFinalWrite=async()=>{await db.query(`select public.${name}($1::jsonb)`,[JSON.stringify({sessionId:'SYN-S',now:new Date().toISOString()})]);};
      await expect(createRecommendation(recommendationDeps(),{assessmentId:'SYN-A',serviceType:'HOME_CARE'},TOKEN)).rejects.toMatchObject({code:'SESSION_INVALID'});
      expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:1,items:1});
    },20000);
  }
});

for (const operation of ['Assessment','Recommendation']) describe(`${operation} final authorization`,()=>{
  const invoke=()=>operation==='Assessment'?createAssessment(assessmentDeps(),assessmentBody(),TOKEN):createRecommendation(recommendationDeps(),{assessmentId:'SYN-A',serviceType:'HOME_CARE'},TOKEN);
  for(const [sql,code] of [["update sessions set token_hash='changed'",'SESSION_INVALID'],["update sessions set expires_at=now()-interval '1 second'",'SESSION_INVALID'],["update consents set withdrawn_at=now()",'CONSENT_REQUIRED']]) it(`${code}: final transaction sees ${sql.split(" ")[3]}`,async()=>{
    beforeFinalWrite=async()=>{await db.exec(sql);};
    await expect(invoke()).rejects.toMatchObject({code});
    expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:1,items:1});
  },20000);
});
it('service_role can complete both normal health-write services; low-privilege roles cannot call the guards',async()=>{
  for(const fn of ['require_writable_session','create_assessment_authorized','create_recommendation_authorized']) {
    const grants=(await db.query("select has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service",[`public.${fn}(jsonb)`])).rows[0];
    expect(grants).toEqual({anon:false,authenticated:false,service:true});
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);await expect(db.query(`select public.${fn}('{}'::jsonb)`)).rejects.toMatchObject({code:'42501'});await db.exec('reset role');
    }
  }
  await db.exec('set role service_role');
  const created=await createAssessment(assessmentDeps(),assessmentBody(),TOKEN);expect(created.assessment.sessionId).toBe('SYN-S');
  const rec=await createRecommendation(recommendationDeps(),{assessmentId:created.assessment.id,serviceType:'HOME_CARE'},TOKEN);expect(rec.rankingType).toBe('NO_LOCATION');
  await db.exec('reset role');expect(await healthCounts()).toEqual({assessments:2,profiles:1,runs:2,items:1});
},20000);
it('a profile INSERT failure rolls back the authorized Assessment; errors do not leak SQL or synthetic contents',async()=>{
  await db.exec("create function zz_fail_profile() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_PROFILE_SQL';end $$;create trigger zz_fail_profile before insert on care_need_profiles for each row execute function zz_fail_profile()");
  const error=await createAssessment(assessmentDeps(),assessmentBody(),TOKEN).catch(e=>e);
  expect(error).toMatchObject({code:'INTERNAL_ERROR'});expect(error.message).not.toContain('SYNTHETIC_PROFILE_SQL');
  expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:1,items:1});
},20000);
it('an Item INSERT failure rolls back the authorized Recommendation Run; a valid retry writes both',async()=>{
  const repo=new SupabaseRecommendationRepository();const security={sessionId:'SYN-S',sessionTokenHash:createHash('sha256').update(TOKEN).digest('hex')};
  const run={id:'SYN-R2',assessmentId:'SYN-A',serviceType:'HOME_CARE' as const,rankingType:'DISTRICT_ROTATION' as const,locationPrecision:'DISTRICT' as const,knowledgeVersion:'SYNTHETIC',createdAt:NOW};
  const item={id:'SYN-I2',recommendationRunId:'SYN-R2',providerId:'MISSING',rank:1 as const,score:100,distanceKm:null,reasons:['synthetic'],createdAt:NOW};
  await repo.insertRun(run,security);await expect(repo.insertItems([item])).rejects.toMatchObject({code:'INTERNAL_ERROR'});
  expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:1,items:1});
  await repo.insertRun(run,security);await repo.insertItems([{...item,providerId:'SYN-P'}]);
  expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:2,items:2});
},20000);
it('cross-Session Assessment is checked again inside the recommendation write transaction',async()=>{
  await insert('sessions',{id:'OTHER-S'});
  beforeFinalWrite=async()=>{await db.exec("update assessments set session_id='OTHER-S' where id='SYN-A'");};
  await expect(createRecommendation(recommendationDeps(),{assessmentId:'SYN-A',serviceType:'HOME_CARE'},TOKEN)).rejects.toMatchObject({code:'NOT_FOUND'});
  expect(await healthCounts()).toEqual({assessments:1,profiles:0,runs:1,items:1});
},20000);
