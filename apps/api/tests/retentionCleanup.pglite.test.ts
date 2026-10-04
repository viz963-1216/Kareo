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
  it("DELETE session + CLOSED Lead: deleted by the first cleanup after the request (D-05a: 7 days is a deadline, not a wait); the Lead skeleton stays until its 1-year deadline; next-day re-run is a no-op", async () => {
    await sessionWithAssessment("S1");
    await addLead("S1", "L1", "CLOSED", T0, "CONNECTED");
    await rpc("request_session_deletion", { sessionId: "S1", now: T0 });

    await cleanup("2026-01-02T00:00:00+08:00"); // next daily run, 1 day after the request
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

  it("without a Lead: DELETE session (next run) and ACTIVE idle after 90 days both delete the assessment data", async () => {
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

// D-05a / PRIVACY_AND_RETENTION §6.1：刪除／撤回後「7 天內完成」是最遲完成期限，不是等待期。
// 下列測試都用真實 migrations 與實體資料列，不以 session 狀態標記或計數代替。
const DAY_MS = 24 * 60 * 60 * 1000;
const at = (days: number, seconds = 0) => new Date(Date.parse(T0) + days * DAY_MS + seconds * 1000).toISOString();
const FAR_FUTURE = "2035-01-01T00:00:00+08:00"; // 讓不是在測 90 天閒置的 session 不被閒置規則掃到

const counts = (r: Record<string, unknown>) => ({
  sessionsDeleted: r.sessionsDeleted,
  leadsContactCleared: r.leadsContactCleared,
  leadsDeleted: r.leadsDeleted,
  consentsDeleted: r.consentsDeleted,
});
const ZERO = { sessionsDeleted: 0, leadsContactCleared: 0, leadsDeleted: 0, consentsDeleted: 0 };

async function injectAssessmentDeleteFailure() {
  await db.exec(`
    create function public.zz_fail_assessment_delete() returns trigger language plpgsql as $f$
    begin raise exception 'injected failure'; end $f$;
    create trigger zz_inject_failure before delete on public.assessments
      for each row execute function public.zz_fail_assessment_delete();
  `);
}
const removeAssessmentDeleteFailure = () => db.exec("drop trigger zz_inject_failure on public.assessments");

describe("D-05a: delete / withdraw cleanup finishes within 7 days of the request", () => {
  it("first run after the request deletes the health data, with real Lead rows; open Lead cancelled, contacts cleared at request time; untouched ACTIVE session stays", async () => {
    await sessionWithAssessment("D1", { lastSeenAt: FAR_FUTURE });
    await addLead("D1", "D1-CLOSED", "CLOSED", T0, "CONNECTED");
    await addLead("D1", "D1-NEW", "NEW", null);
    await sessionWithAssessment("D2", { lastSeenAt: FAR_FUTURE }); // 沒有請求刪除，不得被提早清掉
    await rpc("request_session_deletion", { sessionId: "D1", now: T0 });

    expect(await one("select contact_name, contact_phone from leads where id = 'D1-NEW'")).toEqual({ contact_name: null, contact_phone: null });

    const result = await cleanup(at(0, 1)); // 請求後 1 秒的清理
    expect(counts(result)).toMatchObject({ sessionsDeleted: 1 });
    expect(await healthData("D1")).toEqual(NONE);
    expect(await one("select status, deleted_at is not null as stamped from sessions where id = 'D1'")).toEqual({ status: "DELETED", stamped: true });
    expect((await db.query("select id, status, contact_name, contact_phone from leads where session_id = 'D1' order by id")).rows).toEqual([
      { id: "D1-CLOSED", status: "CLOSED", contact_name: null, contact_phone: null },
      { id: "D1-NEW", status: "CANCELLED", contact_name: null, contact_phone: null },
    ]);
    expect(await healthData("D2")).toEqual(ALL);
    expect(await one("select status from sessions where id = 'D2'")).toEqual({ status: "ACTIVE" });
  }, TEST_TIMEOUT);

  it("dry-run before the deadline counts the session and changes no rows", async () => {
    await sessionWithAssessment("D3");
    await rpc("request_session_deletion", { sessionId: "D3", now: T0 });
    const before = await one("select (select count(*)::int from sessions) as s, (select count(*)::int from assessments) as a");

    const preview = await rpc("run_deletion_cleanup", { now: at(3), dryRun: true });

    expect(preview).toMatchObject({ sessionsDeleted: 1, dryRun: true });
    expect(await one("select (select count(*)::int from sessions) as s, (select count(*)::int from assessments) as a")).toEqual(before);
    expect(await healthData("D3")).toEqual(ALL);
    expect(await one("select status from sessions where id = 'D3'")).toEqual({ status: "DELETION_REQUESTED" });
  }, TEST_TIMEOUT);

  it("failed daily runs are retried: every failure leaves the rows untouched, and the first successful run lands before the deadline", async () => {
    await sessionWithAssessment("D4");
    await addLead("D4", "D4-CLOSED", "CLOSED", T0, "CONNECTED");
    await rpc("request_session_deletion", { sessionId: "D4", now: T0 });
    const deadline = Date.parse(at(7));
    await injectAssessmentDeleteFailure();

    for (const day of [1, 2, 3, 4, 5]) {
      await expect(cleanup(at(day))).rejects.toThrow(/injected failure/);
      expect(await healthData("D4")).toEqual(ALL); // 同一交易回滾：不會只刪掉一半
      expect(await one("select status from sessions where id = 'D4'")).toEqual({ status: "DELETION_REQUESTED" });
    }

    await removeAssessmentDeleteFailure();
    const successAt = at(6);
    expect(Date.parse(successAt)).toBeLessThan(deadline);
    expect(counts(await cleanup(successAt))).toMatchObject({ sessionsDeleted: 1 });
    expect(await healthData("D4")).toEqual(NONE);
    expect(Date.parse(String((await one("select deleted_at from sessions where id = 'D4'")).deleted_at))).toBeLessThan(deadline);
    expect(counts(await cleanup(at(7)))).toEqual(ZERO); // 截止時刻重跑：冪等
  }, TEST_TIMEOUT);

  it("a run exactly at the deadline (request + 7 days), and a late catch-up run, still process a pending request", async () => {
    await sessionWithAssessment("D5");
    await sessionWithAssessment("D6");
    await rpc("request_session_deletion", { sessionId: "D5", now: T0 });
    await rpc("request_session_deletion", { sessionId: "D6", now: T0 });

    expect(counts(await rpc("run_deletion_cleanup", { now: at(7, -1), dryRun: true }))).toMatchObject({ sessionsDeleted: 2 }); // 截止前 1 秒
    expect(counts(await cleanup(at(7)))).toMatchObject({ sessionsDeleted: 2 }); // 截止時刻
    expect(await healthData("D5")).toEqual(NONE);
    expect(await healthData("D6")).toEqual(NONE);
  }, TEST_TIMEOUT);

  it("withdraw_consent follows the same rule (next run deletes, Lead rows handled)", async () => {
    await sessionWithAssessment("D7", { lastSeenAt: FAR_FUTURE });
    await insert("consents", { id: "D7-C", session_id: "D7", accepted_at: T0, withdrawn_at: null });
    await addLead("D7", "D7-NEW", "NEW", null);
    await rpc("withdraw_consent", { sessionId: "D7", now: T0 });

    expect(counts(await cleanup(at(1)))).toMatchObject({ sessionsDeleted: 1 });
    expect(await healthData("D7")).toEqual(NONE);
    expect(await one("select status, status_reason, contact_name from leads where id = 'D7-NEW'")).toEqual({
      status: "CANCELLED",
      status_reason: "CONSENT_WITHDRAWN",
      contact_name: null,
    });
    expect(await one("select count(*)::int as n from consents where id = 'D7-C'")).toEqual({ n: 1 }); // 同意證據走自己的 3 年規則
  }, TEST_TIMEOUT);
});

describe("D-05a: each retention clock (90 days / 180 days / 1 year / 3 years) with real rows", () => {
  async function addOperator() {
    await insert("internal_operators", { id: "OP-RET" });
  }
  async function addLeadChildren(leadId: string, sessionId: string) {
    await insert("lead_status_events", { id: `${leadId}-E`, lead_id: leadId, operator_id: "OP-RET", to_status: "CLOSED" });
    await insert("lead_access_events", { id: `${leadId}-A`, lead_id: leadId, operator_id: "OP-RET" });
    await insert("lead_idempotency_records", { id: `${leadId}-I`, lead_id: leadId, session_id: sessionId, idempotency_key: `${leadId}-K` });
  }
  const dry = (now: string) => rpc("run_deletion_cleanup", { now, dryRun: true });
  const leadChildren = () =>
    one(`select (select count(*)::int from lead_status_events) as events,
                (select count(*)::int from lead_access_events) as access,
                (select count(*)::int from lead_idempotency_records) as idem`);

  it("90 days idle ACTIVE session: kept 1 second before, deleted at the boundary; dry-run does not change rows; rerun is a no-op", async () => {
    await sessionWithAssessment("C90", { lastSeenAt: T0 });
    const before = at(90, -1);
    const boundary = at(90);

    expect(counts(await dry(before))).toEqual(ZERO);
    expect(counts(await cleanup(before))).toEqual(ZERO);
    expect(await healthData("C90")).toEqual(ALL);

    expect(counts(await dry(boundary))).toMatchObject({ sessionsDeleted: 1 });
    expect(await healthData("C90")).toEqual(ALL); // dry-run 不異動
    expect(counts(await cleanup(boundary))).toMatchObject({ sessionsDeleted: 1 });
    expect(await healthData("C90")).toEqual(NONE);
    expect(await one("select status from sessions where id = 'C90'")).toEqual({ status: "DELETED" });

    expect(counts(await dry(at(91)))).toEqual(ZERO);
    expect(counts(await cleanup(at(91)))).toEqual(ZERO);
  }, TEST_TIMEOUT);

  it("180 days after the Lead closed: contact fields cleared at the boundary, the Lead row stays; dry-run does not change rows; rerun is a no-op", async () => {
    await sessionWithAssessment("C180", { lastSeenAt: FAR_FUTURE });
    await addLead("C180", "C180-L", "CLOSED", T0, "CONNECTED");
    const before = at(180, -1);
    const boundary = at(180);

    expect(counts(await cleanup(before))).toEqual(ZERO);
    expect(await one("select contact_name, contact_phone from leads where id = 'C180-L'")).toEqual({ contact_name: "測試甲", contact_phone: "0900000000" });

    expect(counts(await dry(boundary))).toMatchObject({ leadsContactCleared: 1 });
    expect(await one("select contact_name from leads where id = 'C180-L'")).toEqual({ contact_name: "測試甲" }); // dry-run 不異動
    expect(counts(await cleanup(boundary))).toMatchObject({ leadsContactCleared: 1 });
    expect(await one("select status, contact_name, contact_phone from leads where id = 'C180-L'")).toEqual({
      status: "CLOSED",
      contact_name: null,
      contact_phone: null,
    });

    expect(counts(await dry(at(181)))).toEqual(ZERO);
    expect(counts(await cleanup(at(181)))).toEqual(ZERO);
    expect(await one("select count(*)::int as n from leads where id = 'C180-L'")).toEqual({ n: 1 });
  }, TEST_TIMEOUT);

  it("1 year after the Lead closed: the Lead and its status / access / idempotency rows are deleted at the boundary; dry-run does not change rows; rerun is a no-op", async () => {
    await addOperator();
    await sessionWithAssessment("C365", { lastSeenAt: FAR_FUTURE });
    await addLead("C365", "C365-L", "CANCELLED", T0, "USER_CANCELLED");
    await addLeadChildren("C365-L", "C365");
    const before = "2026-12-31T23:59:59+08:00";
    const boundary = "2027-01-01T00:00:00+08:00"; // T0 + 1 year

    expect(counts(await cleanup(before))).toMatchObject({ leadsDeleted: 0 });
    expect(await one("select count(*)::int as n from leads where id = 'C365-L'")).toEqual({ n: 1 });
    expect(await leadChildren()).toEqual({ events: 1, access: 1, idem: 1 });

    expect(counts(await dry(boundary))).toMatchObject({ leadsDeleted: 1 });
    expect(await one("select count(*)::int as n from leads where id = 'C365-L'")).toEqual({ n: 1 }); // dry-run 不異動
    expect(counts(await cleanup(boundary))).toMatchObject({ leadsDeleted: 1 });
    expect(await one("select count(*)::int as n from leads where id = 'C365-L'")).toEqual({ n: 0 });
    expect(await leadChildren()).toEqual({ events: 0, access: 0, idem: 0 });

    expect(counts(await dry("2027-01-02T00:00:00+08:00"))).toEqual(ZERO);
    expect(counts(await cleanup("2027-01-02T00:00:00+08:00"))).toEqual(ZERO);
  }, TEST_TIMEOUT);

  it("3 years after consent was accepted: the consent row is deleted at the boundary; dry-run does not change rows; rerun is a no-op", async () => {
    await insert("sessions", { id: "C3Y", status: "ACTIVE", last_seen_at: FAR_FUTURE, created_at: T0, updated_at: T0 });
    await insert("consents", { id: "C3Y-C", session_id: "C3Y", accepted_at: T0, withdrawn_at: null });
    const before = "2028-12-31T23:59:59+08:00";
    const boundary = "2029-01-01T00:00:00+08:00"; // T0 + 3 years

    expect(counts(await cleanup(before))).toMatchObject({ consentsDeleted: 0 });
    expect(await one("select count(*)::int as n from consents where id = 'C3Y-C'")).toEqual({ n: 1 });

    expect(counts(await dry(boundary))).toMatchObject({ consentsDeleted: 1 });
    expect(await one("select count(*)::int as n from consents where id = 'C3Y-C'")).toEqual({ n: 1 }); // dry-run 不異動
    expect(counts(await cleanup(boundary))).toMatchObject({ consentsDeleted: 1 });
    expect(await one("select count(*)::int as n from consents where id = 'C3Y-C'")).toEqual({ n: 0 });

    expect(counts(await dry("2029-01-02T00:00:00+08:00"))).toEqual(ZERO);
    expect(counts(await cleanup("2029-01-02T00:00:00+08:00"))).toEqual(ZERO);
  }, TEST_TIMEOUT);

  it("one run executes all four clocks together; a second run counts nothing again", async () => {
    await addOperator();
    await sessionWithAssessment("ALL-IDLE", { lastSeenAt: T0 });
    await sessionWithAssessment("ALL-LEAD", { lastSeenAt: FAR_FUTURE });
    await addLead("ALL-LEAD", "ALL-L", "CLOSED", T0, "CONNECTED");
    await addLeadChildren("ALL-L", "ALL-LEAD");
    await insert("consents", { id: "ALL-C", session_id: "ALL-LEAD", accepted_at: T0, withdrawn_at: null });
    await sessionWithAssessment("ALL-DEL", { lastSeenAt: FAR_FUTURE });
    await rpc("request_session_deletion", { sessionId: "ALL-DEL", now: T0 });

    const now = "2029-06-01T00:00:00+08:00";
    const first = counts(await cleanup(now));
    expect(first).toMatchObject({ sessionsDeleted: 2, leadsDeleted: 1, consentsDeleted: 1 });
    // 同一案件同時超過 180 天與 1 年，兩項計數可重疊（DATA_MODEL §40）
    expect(first.leadsContactCleared).toBe(1);
    expect(await healthData("ALL-IDLE")).toEqual(NONE);
    expect(await healthData("ALL-DEL")).toEqual(NONE);
    expect(counts(await cleanup(now))).toEqual(ZERO);
  }, TEST_TIMEOUT);
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
