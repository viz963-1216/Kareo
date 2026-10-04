// B-011b: actual repository/service + real migration SQL, isolated synthetic data.
// The SDK boundary forwards RPCs/inserts into PostgreSQL, never to a cloud project.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { runRetentionCleanup } from "../src/services/retentionService.js";
import { SupabaseSessionRepository } from "../src/repositories/supabaseSessionRepository.js";

let db: PGlite;
vi.mock("../src/repositories/supabaseClient.js", () => ({
  getSupabaseClient: () => ({
    rpc: async (fn: string, args: { payload: unknown }) => {
      if (!["run_deletion_cleanup", "run_deletion_cleanup_recorded"].includes(fn)) throw new Error("Unexpected test RPC");
      try {
        const r = await db.query<{ result: unknown }>(`select public.${fn}($1::jsonb) result`, [JSON.stringify(args.payload)]);
        return { data: r.rows[0].result, error: null };
      } catch { return { data: null, error: { code: "LOCAL-TEST", message: "synthetic RPC failure" } }; }
    },
    from: (table: string) => ({ insert: async (row: Record<string, unknown>) => {
      if (table !== "deletion_runs") throw new Error("Unexpected test insert");
      try {
        await db.query("insert into public.deletion_runs select * from jsonb_populate_record(null::public.deletion_runs, $1::jsonb)", [JSON.stringify(row)]);
        return { error: null };
      } catch { return { error: { code: "LOCAL-TEST", message: "synthetic audit failure" } }; }
    } }),
  }),
}));

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/migrations");
const T0 = "2026-10-04T00:00:00Z";
const ALL = { assessments: 1, profiles: 1, runs: 1, items: 1 };
const NONE = { assessments: 0, profiles: 0, runs: 0, items: 0 };
const repo = () => new SupabaseSessionRepository();
const state = async () => (await db.query(`select
  (select count(*)::int from assessments) assessments,
  (select count(*)::int from care_need_profiles) profiles,
  (select count(*)::int from recommendation_runs) runs,
  (select count(*)::int from recommendation_items) items`)).rows[0];
const audits = async () => (await db.query<{ status: string; sessions_deleted: number; operator_id: string }>("select status, sessions_deleted, operator_id from deletion_runs order by status, started_at, id")).rows;
const cleanup = (dryRun = false) => runRetentionCleanup(repo(), { now: T0, dryRun, operatorId: "SYNTHETIC-STEWARD" });

async function insert(table: string, values: Record<string, unknown>) {
  const { rows: cols } = await db.query<{ column_name: string; data_type: string }>(`select column_name,data_type from information_schema.columns
    where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null`, [table]);
  const row = { ...values };
  for (const { column_name: c, data_type: t } of cols) if (!(c in row)) {
    row[c] = /timestamp|date/.test(t) ? T0 : /int|numeric|double|real/.test(t) ? 0 : t === "boolean" ? false
      : ["json", "jsonb", "ARRAY"].includes(t) ? "{}" : "SYNTHETIC";
  }
  const keys = Object.keys(row);
  await db.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_, i) => '$'+(i+1)).join(',')})`, keys.map(k => row[k]));
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(dir, f), 'utf8'));
  await insert('internal_operators', { id: 'SYNTHETIC-STEWARD', display_name: 'Synthetic operator', roles: '{DATA_STEWARD}', active: true, revoked_at: null });
  await insert('providers', { id: 'SYNTHETIC-P' });
  await insert('sessions', { id: 'SYNTHETIC-S', status: 'DELETION_REQUESTED' });
  await insert('assessments', { id: 'SYNTHETIC-A', session_id: 'SYNTHETIC-S' });
  await insert('care_need_profiles', { id: 'SYNTHETIC-C', assessment_id: 'SYNTHETIC-A' });
  await insert('recommendation_runs', { id: 'SYNTHETIC-R', assessment_id: 'SYNTHETIC-A', service_type: 'HOME_CARE' });
  await insert('recommendation_items', { id: 'SYNTHETIC-I', recommendation_run_id: 'SYNTHETIC-R', provider_id: 'SYNTHETIC-P', rank: 1 });
}, 30000);
afterEach(async () => { await db.close(); });

async function failAudit() {
  await db.exec(`create function zz_fail_cleanup_audit() returns trigger language plpgsql as $$
    begin if new.status='SUCCESS' then raise exception 'AUDIT_FAIL_SYNTHETIC'; end if; return new; end $$;
    create trigger zz_fail_cleanup_audit before insert on deletion_runs for each row execute function zz_fail_cleanup_audit()`);
}

describe('cleanup records and deletion commit together', () => {
  it('audit insert failure rolls back all health deletion and leaves a retryable request', async () => {
    await failAudit();
    await expect(cleanup()).rejects.toThrow();
    expect(await state()).toEqual(ALL);
    expect((await db.query("select status from sessions where id='SYNTHETIC-S'")).rows[0]).toEqual({ status: 'DELETION_REQUESTED' });
    expect(await audits()).toEqual([{ status: 'FAILED', sessions_deleted: 0, operator_id: 'SYNTHETIC-STEWARD' }]);
  }, 20000);

  it('successful retry commits actual deletion and one exact-count success audit; a later run counts zero', async () => {
    await failAudit(); await expect(cleanup()).rejects.toThrow();
    await db.exec('drop trigger zz_fail_cleanup_audit on deletion_runs');
    await db.exec('set role service_role');
    const first = await cleanup();
    expect(first.sessionsDeleted).toBe(1); expect(await state()).toEqual(NONE);
    expect(await audits()).toContainEqual({ status: 'SUCCESS', sessions_deleted: 1, operator_id: 'SYNTHETIC-STEWARD' });
    const second = await cleanup(); expect(second.sessionsDeleted).toBe(0);
    expect((await audits()).filter(r => r.status === 'SUCCESS').map(r => r.sessions_deleted).sort()).toEqual([0, 1]);
  }, 20000);

  it('dry-run uses the actual SQL and writes neither data nor an audit', async () => {
    await db.exec('set role service_role');
    const run = await cleanup(true); expect(run.sessionsDeleted).toBe(1);
    expect(await state()).toEqual(ALL); expect(await audits()).toEqual([]);
  }, 20000);

  it('a deletion failure writes only FAILED and leaves all dependent health rows unchanged', async () => {
    await db.exec(`create function zz_fail_health_delete() returns trigger language plpgsql as $$
      begin raise exception 'HEALTH_FAIL_SYNTHETIC'; end $$;
      create trigger zz_fail_health_delete before delete on assessments for each row execute function zz_fail_health_delete()`);
    await expect(cleanup()).rejects.toThrow();
    expect(await state()).toEqual(ALL);
    expect(await audits()).toEqual([{ status: 'FAILED', sessions_deleted: 0, operator_id: 'SYNTHETIC-STEWARD' }]);
  }, 20000);

  it('the recorded RPC rejects inactive or non-steward operators before deleting anything', async () => {
    for (const change of ["roles=array['LEAD_OPERATOR']", "roles=array['DATA_STEWARD'],active=false", "active=true,revoked_at=now()"]) {
      await db.exec(`update internal_operators set ${change} where id='SYNTHETIC-STEWARD'`);
      await expect(db.query('select public.run_deletion_cleanup_recorded($1::jsonb)', [JSON.stringify({ runId: 'DRUN-SYNTHETIC', operatorId: 'SYNTHETIC-STEWARD', now: T0, dryRun: false })])).rejects.toThrow();
      expect(await state()).toEqual(ALL); expect(await audits()).toEqual([]);
    }
  }, 20000);

  it('anon and authenticated cannot invoke the recorded deletion function', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try { await expect(db.query('select public.run_deletion_cleanup_recorded($1::jsonb)', ['{}'])).rejects.toThrow(); }
      finally { await db.exec('reset role'); }
    }
    expect(await state()).toEqual(ALL); expect(await audits()).toEqual([]);
  }, 20000);
});
