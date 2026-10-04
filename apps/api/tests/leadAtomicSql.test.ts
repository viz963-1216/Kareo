// B-006: the real service + all Supabase repositories, actual SQL in a disposable DB.
// The local SDK boundary supports only the query operations used by these repositories.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createLead } from '../src/services/leadService.js';
import { SupabaseLeadRepository } from '../src/repositories/supabaseLeadRepository.js';
import { SupabaseSessionRepository } from '../src/repositories/supabaseSessionRepository.js';
import { SupabaseConsentRepository } from '../src/repositories/supabaseConsentRepository.js';
import { SupabaseAssessmentRepository } from '../src/repositories/supabaseAssessmentRepository.js';
import { SupabaseRecommendationRepository } from '../src/repositories/supabaseRecommendationRepository.js';

let db: PGlite;
let beforeLeadCommit: (() => Promise<void>) | undefined;
const allowedTables = new Set(['sessions','consents','assessments','recommendation_runs','recommendation_items','leads','lead_idempotency_records']);
const safe = (s: string) => { if (!/^[a-z_]+$/.test(s)) throw new Error('Unsupported test identifier'); return s; };
const hook = async () => { const run = beforeLeadCommit; beforeLeadCommit = undefined; await run?.(); };
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
    if (fn !== 'create_lead_with_idempotency') throw new Error('Unsupported test RPC');
    await hook();
    try { const r = await db.query<{ result: unknown }>(`select public.${fn}($1::jsonb) result`,[JSON.stringify(args.payload)]); return { data: r.rows[0].result, error: null }; }
    catch (err) { return { data: null, error: { code: (err as { code?: string }).code, message: (err as Error).message } }; }
  },
}) }));
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../supabase/migrations');
const TOKEN = 'synthetic-local-session-token';
const NOW = new Date().toISOString();
const KEY = '11111111-1111-1111-1111-111111111111';
const request = () => ({ sessionId:'SYN-S',assessmentId:'SYN-A',recommendationId:'SYN-R',providerId:'SYN-P',serviceType:'HOME_CARE',contact:{name:'Synthetic',phone:'0900000000'},contactConsent:true });
const deps = () => ({ sessionRepo:new SupabaseSessionRepository(),consentRepo:new SupabaseConsentRepository(),assessmentRepo:new SupabaseAssessmentRepository(),recommendationRepo:new SupabaseRecommendationRepository(),leadRepo:new SupabaseLeadRepository() });
const counts = async () => (await db.query('select (select count(*)::int from leads) leads,(select count(*)::int from lead_idempotency_records) ledger')).rows[0];
async function insert(table: string, values: Record<string, unknown>) {
  const { rows: cols } = await db.query<{column_name:string;data_type:string}>("select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null",[table]);
  const row = { ...values };
  for (const { column_name:c,data_type:t } of cols) if (!(c in row)) row[c] = /timestamp|date/.test(t) ? NOW : /int|numeric|double|real/.test(t) ? 0 : t==='boolean' ? false : ['json','jsonb','ARRAY'].includes(t) ? '{}' : 'SYNTHETIC';
  const keys=Object.keys(row);await db.query(`insert into ${safe(table)} (${keys.map(safe).join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));
}
beforeEach(async () => {
  db = new PGlite(); beforeLeadCommit = undefined;
  await db.exec('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;');
  for (const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(dir,file),'utf8'));
  await insert('sessions',{id:'SYN-S',status:'ACTIVE',token_hash:createHash('sha256').update(TOKEN).digest('hex'),expires_at:'2035-01-01T00:00:00Z'});
  await insert('consents',{id:'SYN-C',session_id:'SYN-S',withdrawn_at:null});
  await insert('providers',{id:'SYN-P'});
  await insert('assessments',{id:'SYN-A',session_id:'SYN-S',status:'COMPLETED'});
  await insert('recommendation_runs',{id:'SYN-R',assessment_id:'SYN-A',service_type:'HOME_CARE'});
  await insert('recommendation_items',{id:'SYN-I',recommendation_run_id:'SYN-R',provider_id:'SYN-P',rank:1});
},30000);
afterEach(async () => { await db.close(); });

describe('atomic Lead write after the request passed Node validation',()=>{
  it('ledger insert failure leaves neither an orphan Lead nor contact data',async()=>{
    await db.exec(`create function zz_fail_ledger() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_LEDGER_FAILURE'; end $$;create trigger zz_fail_ledger before insert on lead_idempotency_records for each row execute function zz_fail_ledger()`);
    await expect(createLead(deps(),request(),TOKEN,KEY)).rejects.toThrow();
    expect(await counts()).toEqual({leads:0,ledger:0});
  },20000);
  for (const fn of ['request_session_deletion','withdraw_consent']) it(`${fn} committed before the final write rejects the stale request`,async()=>{
    beforeLeadCommit=async()=>{await db.query(`select public.${fn}($1::jsonb)`,[JSON.stringify({sessionId:'SYN-S',now:new Date().toISOString()})]);};
    await expect(createLead(deps(),request(),TOKEN,KEY)).rejects.toMatchObject({code:'SESSION_INVALID'});
    expect(await counts()).toEqual({leads:0,ledger:0});
  },20000);
  for (const [sql,code] of [
    ["update sessions set token_hash='changed'",'SESSION_INVALID'],
    ["update sessions set expires_at=now()-interval '1 second'",'SESSION_INVALID'],
    ["update consents set withdrawn_at=now()",'CONSENT_REQUIRED'],
    ["update assessments set session_id='OTHER-S'",'NOT_FOUND'],
    ["update recommendation_runs set service_type='ASSISTIVE_DEVICE'",'VALIDATION_ERROR'],
    ["delete from recommendation_items",'VALIDATION_ERROR'],
  ]) it(`final transaction rechecks ${code}: ${sql.split(' ')[1]}`,async()=>{
    if (sql.includes('OTHER-S')) await insert('sessions',{id:'OTHER-S'});
    beforeLeadCommit=async()=>{await db.exec(sql);};
    await expect(createLead(deps(),request(),TOKEN,KEY)).rejects.toMatchObject({code});
    expect(await counts()).toEqual({leads:0,ledger:0});
  },20000);
  it('only service_role may execute the invoker function, and service_role can complete a valid write',async()=>{
    const grants=(await db.query("select has_function_privilege('anon','public.create_lead_with_idempotency(jsonb)','EXECUTE') anon,has_function_privilege('authenticated','public.create_lead_with_idempotency(jsonb)','EXECUTE') authenticated,has_function_privilege('service_role','public.create_lead_with_idempotency(jsonb)','EXECUTE') service")).rows[0];
    expect(grants).toEqual({anon:false,authenticated:false,service:true});
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select public.create_lead_with_idempotency('{}'::jsonb)")).rejects.toMatchObject({code:'42501'});
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const created=await createLead(deps(),request(),TOKEN,KEY);
    expect(created.status).toBe('NEW');await db.exec('reset role');
    expect(await counts()).toEqual({leads:1,ledger:1});
  },20000);
  it('same key preserves the original Lead mapping after closure and returns current status; changed content conflicts',async()=>{
    const first=await createLead(deps(),request(),TOKEN,KEY);await db.exec("update leads set status='CLOSED',closed_at=now()");
    const replay=await createLead(deps(),request(),TOKEN,KEY);expect(replay).toEqual({...first,status:"CLOSED"});
    await expect(createLead(deps(),{...request(),contact:{name:'Changed',phone:'0900000000'}},TOKEN,KEY)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
    expect(await counts()).toEqual({leads:1,ledger:1});
  },20000);
  it('two different keys resolve the open business duplicate and preserve both replay mappings',async()=>{
    const first=await createLead(deps(),request(),TOKEN,KEY);
    const second=await createLead(deps(),request(),TOKEN,'22222222-2222-2222-2222-222222222222');
    expect(second.leadId).toBe(first.leadId);expect(second.duplicate).toBe(true);
    expect(await counts()).toEqual({leads:1,ledger:2});
  },20000);
});
