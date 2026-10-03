// Jerry 2026-10-03 審查（#55）：保存期限清理與刪除／撤回的真實 SQL 回歸，常態留在 repo 執行。
// 每個測試用獨立的 PGlite 實例套用本分支全部 migrations，直接呼叫 RPC 並核對資料列，
// 不是只看 session 狀態或回傳計數。不連雲端、只用合成資料。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
const migrationSql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(migrationsDir, f), "utf8"));

const ROLES = "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;";
const T0 = "2026-01-01T00:00:00+08:00";
const TEST_TIMEOUT = 20000;

let db: InstanceType<typeof PGlite>;

async function applyMigrations(target: InstanceType<typeof PGlite>) {
  for (const sql of migrationSql) await target.exec(sql);
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(ROLES);
  await applyMigrations(db);
}, 30000);

afterEach(async () => {
  await db.close();
});

const one = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows[0] as Record<string, unknown>;

// 只填 NOT NULL 且沒有預設值的欄位（同 tests/db/verify-db.mjs 的 insertSynthetic）。
async function insert(table: string, values: Record<string, unknown>) {
  const cols = (
    await db.query(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = $1 and is_nullable = 'NO' and column_default is null`,
      [table]
    )
  ).rows as Array<{ column_name: string; data_type: string }>;
  const row: Record<string, unknown> = { ...values };
  for (const { column_name: c, data_type: t } of cols) {
    if (c in row) continue;
    row[c] = /timestamp|date/.test(t) ? T0 : /int|numeric|double|real/.test(t) ? 0 : t === "boolean" ? false
      : t === "jsonb" || t === "json" ? "{}" : t === "ARRAY" ? "{}" : "SYN";
  }
  const keys = Object.keys(row);
  await db.query(`insert into ${table} (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`, keys.map((k) => row[k]));
}

const rpc = async (fn: string, payload: Record<string, unknown>) =>
  (await one(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(payload)])).r as Record<string, unknown>;
const cleanup = (now: string) => rpc("run_deletion_cleanup", { now, dryRun: false });

// session → assessment → care_need_profile → recommendation_run → recommendation_item
async function sessionWithAssessment(s: string, opts: { status?: string; lastSeenAt?: string | null } = {}) {
  await insert("providers", { id: `${s}-P` });
  await insert("sessions", { id: s, status: opts.status ?? "ACTIVE", last_seen_at: opts.lastSeenAt ?? null, created_at: T0, updated_at: T0 });
  await insert("assessments", { id: `${s}-A`, session_id: s });
  await insert("care_need_profiles", { id: `${s}-CNP`, assessment_id: `${s}-A` });
  await insert("recommendation_runs", { id: `${s}-R`, assessment_id: `${s}-A`, service_type: "HOME_CARE" });
  await insert("recommendation_items", { id: `${s}-RI`, recommendation_run_id: `${s}-R`, provider_id: `${s}-P`, rank: 1 });
}

async function addLead(s: string, id: string, status: string, closedAt: string | null, statusReason: string | null = null) {
  await insert("leads", {
    id,
    session_id: s,
    assessment_id: `${s}-A`,
    recommendation_id: `${s}-R`,
    provider_id: `${s}-P`,
    service_type: "HOME_CARE",
    contact_name: "測試甲",
    contact_phone: "0900000000",
    status,
    status_reason: statusReason,
    closed_at: closedAt,
    idempotency_key: `${id}-K`,
  });
}

const healthData = (s: string) =>
  one(
    `select
      (select count(*)::int from assessments where session_id = $1) as assessments,
      (select count(*)::int from care_need_profiles where assessment_id = $1 || '-A') as profiles,
      (select count(*)::int from recommendation_runs where assessment_id = $1 || '-A') as runs,
      (select count(*)::int from recommendation_items where recommendation_run_id = $1 || '-R') as items`,
    [s]
  );
const NONE = { assessments: 0, profiles: 0, runs: 0, items: 0 };
const ALL = { assessments: 1, profiles: 1, runs: 1, items: 1 };

describe("P1-1: assessment data follows its own deadline even when a Lead exists", () => {
  it("DELETE session + CLOSED Lead: kept before 7 days, deleted after 7 days; the Lead skeleton stays until its 1-year deadline; next-day re-run is a no-op", async () => {
    await sessionWithAssessment("S1");
    await addLead("S1", "L1", "CLOSED", T0, "CONNECTED");
    await rpc("request_session_deletion", { sessionId: "S1", now: T0 });

    await cleanup("2026-01-07T00:00:00+08:00");
    expect(await healthData("S1")).toEqual(ALL); // 6 days: not yet

    await cleanup("2026-01-09T00:00:00+08:00");
    expect(await healthData("S1")).toEqual(NONE);
    expect(await one("select status from sessions where id = 'S1'")).toEqual({ status: "DELETED" });
    expect(await one("select status, assessment_id, recommendation_id from leads where id = 'L1'")).toEqual({
      status: "CLOSED",
      assessment_id: "S1-A",
      recommendation_id: "S1-R",
    });

    await cleanup("2027-01-02T00:00:00+08:00"); // Lead closed 1 year + 1 day
    expect(await one("select count(*)::int as n from leads where id = 'L1'")).toEqual({ n: 0 });
    expect(await healthData("S1")).toEqual(NONE);

    const rerun = await cleanup("2027-01-03T00:00:00+08:00");
    expect(rerun).toMatchObject({ sessionsDeleted: 0, leadsDeleted: 0 });
    expect(await healthData("S1")).toEqual(NONE);
  }, TEST_TIMEOUT);

  it("ACTIVE idle + CLOSED Lead: kept at 89 days, deleted after 90 days; the Lead stays", async () => {
    await sessionWithAssessment("S2", { lastSeenAt: T0 });
    await addLead("S2", "L2", "CLOSED", T0, "CONNECTED");

    await cleanup("2026-03-31T00:00:00+08:00"); // 89 days
    expect(await healthData("S2")).toEqual(ALL);

    await cleanup("2026-04-02T00:00:00+08:00"); // 91 days
    expect(await healthData("S2")).toEqual(NONE);
    expect(await one("select count(*)::int as n from leads where id = 'L2'")).toEqual({ n: 1 });
  }, TEST_TIMEOUT);

  it("without a Lead: DELETE session after 7 days and ACTIVE idle after 90 days both delete the assessment data", async () => {
    await sessionWithAssessment("S3");
    await rpc("request_session_deletion", { sessionId: "S3", now: T0 });
    await sessionWithAssessment("S4", { lastSeenAt: T0 });

    await cleanup("2026-04-02T00:00:00+08:00");

    expect(await healthData("S3")).toEqual(NONE);
    expect(await healthData("S4")).toEqual(NONE);
  }, TEST_TIMEOUT);
});

describe("P1-2: delete / withdraw clear every Lead's contact fields; only open Leads change status", () => {
  for (const [fn, reason] of [
    ["request_session_deletion", "USER_DELETED"],
    ["withdraw_consent", "CONSENT_WITHDRAWN"],
  ] as const) {
    it(`${fn}: CLOSED / CANCELLED / NEW`, async () => {
      await sessionWithAssessment("S5");
      if (fn === "withdraw_consent") await insert("consents", { id: "C5", session_id: "S5", accepted_at: T0, withdrawn_at: null });
      await addLead("S5", "L5-CLOSED", "CLOSED", T0, "CONNECTED");
      await addLead("S5", "L5-CANCELLED", "CANCELLED", T0, "USER_CANCELLED");
      await addLead("S5", "L5-NEW", "NEW", null);

      const result = await rpc(fn, { sessionId: "S5", now: "2026-01-02T00:00:00+08:00" });

      expect(result).toMatchObject({ updated: true, leadsCancelled: 1 });
      const leads = (
        await db.query(
          "select id, status, status_reason, contact_name, contact_phone from leads where session_id = 'S5' order by id"
        )
      ).rows;
      expect(leads).toEqual([
        { id: "L5-CANCELLED", status: "CANCELLED", status_reason: "USER_CANCELLED", contact_name: null, contact_phone: null },
        { id: "L5-CLOSED", status: "CLOSED", status_reason: "CONNECTED", contact_name: null, contact_phone: null },
        { id: "L5-NEW", status: "CANCELLED", status_reason: reason, contact_name: null, contact_phone: null },
      ]);
      const events = (await db.query("select lead_id, to_status from lead_status_events order by lead_id")).rows;
      expect(events).toEqual([{ lead_id: "L5-NEW", to_status: "CANCELLED" }]);
    }, TEST_TIMEOUT);
  }
});

describe("public.rls_auto_enable(): unnecessary EXECUTE revoked, event trigger kept", () => {
  it("revokes anon/authenticated EXECUTE when the function exists, keeps the event trigger and automatic RLS", async () => {
    // 雲端專案既有、非本專案 migration 建立的函式；此處以替身在套用 migrations 前建立。
    const cloudLike = new PGlite();
    try {
      await cloudLike.exec(ROLES);
      await cloudLike.exec(`
        create or replace function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $f$
        declare r record;
        begin
          for r in select * from pg_event_trigger_ddl_commands() where command_tag = 'CREATE TABLE' and schema_name = 'public' loop
            execute format('alter table %s enable row level security', r.object_identity);
          end loop;
        end $f$;
        grant execute on function public.rls_auto_enable() to anon, authenticated;
        create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
      `);
      await applyMigrations(cloudLike);

      const priv = (
        await cloudLike.query(`select
          has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') as anon,
          has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') as authenticated`)
      ).rows[0];
      expect(priv).toEqual({ anon: false, authenticated: false });
      expect((await cloudLike.query("select evtenabled from pg_event_trigger where evtname = 'ensure_rls'")).rows).toEqual([{ evtenabled: "O" }]);
      await cloudLike.exec("create table public.zz_after_migration (id int)");
      expect((await cloudLike.query("select relrowsecurity from pg_class where relname = 'zz_after_migration'")).rows).toEqual([{ relrowsecurity: true }]);
    } finally {
      await cloudLike.close();
    }
  }, 40000);

  it("migrations apply on a database without rls_auto_enable (fresh / local)", async () => {
    expect(await one("select count(*)::int as n from pg_proc where proname = 'rls_auto_enable'")).toEqual({ n: 0 });
  }, TEST_TIMEOUT);
});
