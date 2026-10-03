// TASK-B-012-r3（Jerry 指示 4）：「新增 RPC 的行為測試請保留在 repo 常態執行」——跟之前「寫一次性
// scratch 腳本驗證完就刪」的慣例不同，這份測試用 @electric-sql/pglite（已核准的 apps/api
// devDependency，見 package.json／GIT_RULES §9）在記憶體內跑完全部 migrations，直接對
// upsert_content_pack／compute_publish_plan／admin_publish_knowledge_version 這三個 B-012-r3
// 新增的 RPC 做行為驗證，常態留在 repo 裡執行（随 npx vitest run 一起跑，不需要真正的 Supabase）。
//
// 已知限制（誠實揭露，不得宣稱已驗證）：PGlite 把所有查詢序列化到同一個邏輯連線，無法真正模擬
// 「另一個連線在交易中持有 pg_advisory_xact_lock 時會被鎖住」的併發阻塞行為；雙連線併發驗證
// 需要 J-003 用真實 Postgres（staging Supabase）執行，不在本檔案的驗證範圍內。這裡只驗證
// 「鎖→重算→比對→寫入」這條邏輯路徑在單一交易內的行為是否正確。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const migrationSql = migrationFiles.map((f) => readFileSync(path.join(migrationsDir, f), "utf8"));

let db: InstanceType<typeof PGlite>;

async function query(sql: string, params?: unknown[]) {
  return db.query(sql, params);
}
async function one(sql: string, params?: unknown[]) {
  return (await query(sql, params)).rows[0] as Record<string, unknown> | undefined;
}
async function fails(sql: string, params?: unknown[]): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
const PACK_REVIEW = { reviewedBy: "Jerry", reviewedAt: "2026-09-24T09:52:27+08:00", reviewDecision: "APPROVED" };
const NO_REVIEW = { reviewedBy: null, reviewedAt: null, reviewDecision: null };
// 完整的 upsert_content_pack payload；status=APPROVED 時預設帶完整內容包 review。
const upsertPack = (input: Record<string, unknown>) =>
  fails("select public.upsert_content_pack($1::jsonb)", [
    JSON.stringify({
      now: "2026-10-01T00:00:00+08:00",
      formatVersion: "1.0",
      sourceRegistryVersion: "SR-1",
      importedBy: "TEST",
      recordsFingerprint: "records-fp",
      ...(input.status === "APPROVED" ? PACK_REVIEW : NO_REVIEW),
      ...input,
    }),
  ]);

// compute_publish_plan() looks at every APPROVED record in the whole database, not just the ones a
// single test creates — a fresh PGlite instance per test keeps tests independent instead of leaving
// one test's APPROVED-but-unregistered records to break another test's plan computation later.
beforeEach(async () => {
  db = new PGlite();
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for (const sql of migrationSql) {
    await db.exec(sql);
  }
}, 30000);

afterEach(async () => {
  await db.close();
});

let seq = 0;
async function ensureSource() {
  await query(`insert into knowledge_sources (id, name, authority, jurisdiction, source_url, active, created_at, updated_at)
    values ('RPC-SRC', 'synthetic', 'MOHW', 'TAIWAN', 'https://1966.gov.tw/', true, now(), now()) on conflict (id) do nothing`);
}
async function addApprovedRecord(pack: string, title = "RPC test record") {
  const id = `RPC-KREC-${++seq}`;
  const now = "2026-10-01T00:00:00+08:00";
  await query(
    `insert into knowledge_records (id, source_id, title, category, jurisdiction, source_url, effective_from, effective_to,
      fetched_at, last_verified_at, content_hash, status, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id, content_fingerprint)
     values ($1, 'RPC-SRC', $2, 'BENEFIT', 'TAIWAN', 'https://1966.gov.tw/', '2026-01-01', null, $3, $3, $4, 'APPROVED', 'synthetic', 'synthetic', '{}'::jsonb, $3, $3, $5, $1, $6)`,
    [id, title, now, `sha256:${String(seq).padStart(64, "0")}`, pack, `rpc-content-fp-${seq}`]
  );
  return id;
}

describe("upsert_content_pack (DATA_MODEL §26b, Jerry 2026-10-03 items 1 and 3)", () => {
  it("registers a new pack and persists format version, pack review and import evidence", async () => {
    const packId = "RPC-PACK-upsert-1";
    expect(await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-900", status: "APPROVED", packFingerprint: "fp-1" })).toBeNull();
    const row = await one(
      "select status, format_version, reviewed_by, reviewed_at, review_decision, records_fingerprint, imported_by, imported_at from content_packs where id = $1",
      [packId]
    );
    expect(row).toMatchObject({
      status: "APPROVED",
      format_version: "1.0",
      reviewed_by: "Jerry",
      review_decision: "APPROVED",
      records_fingerprint: "records-fp",
      imported_by: "TEST",
    });
    expect(row?.reviewed_at).toBeTruthy();
    expect(row?.imported_at).toBeTruthy();
  });

  it("database rejects an APPROVED pack without a complete pack review (not only the status string)", async () => {
    for (const review of [NO_REVIEW, { ...PACK_REVIEW, reviewedBy: null }, { ...PACK_REVIEW, reviewedAt: null }, { ...PACK_REVIEW, reviewDecision: "REJECTED" }]) {
      const err = await upsertPack({ packId: "RPC-PACK-noreview", intendedKnowledgeVersion: "KB-2026-10-01-900", status: "APPROVED", packFingerprint: "fp", ...review });
      expect(err).toMatch(/content_packs_approved_review_check/);
    }
    expect(await one("select count(*)::int as n from content_packs where id = 'RPC-PACK-noreview'")).toEqual({ n: 0 });
  });

  it("same content: promotes NEEDS_REVIEW -> APPROVED and stores the pack review", async () => {
    const packId = "RPC-PACK-upsert-2";
    await upsertPack({ packId, intendedKnowledgeVersion: null, status: "NEEDS_REVIEW", packFingerprint: "fp-needs-review" });
    const err = await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-900", status: "APPROVED", packFingerprint: "fp-approved" });
    expect(err).toBeNull();
    const row = await one("select status, intended_knowledge_version, reviewed_by, pack_fingerprint from content_packs where id = $1", [packId]);
    expect(row).toMatchObject({ status: "APPROVED", intended_knowledge_version: "KB-2026-10-01-900", reviewed_by: "Jerry", pack_fingerprint: "fp-approved" });
  });

  for (const declared of ["NEEDS_REVIEW", "APPROVED"]) {
    it(`registered pack + changed records fingerprint is rejected even when this call declares ${declared}; row untouched`, async () => {
      const packId = `RPC-PACK-changed-${declared}`;
      await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-901", status: "APPROVED", packFingerprint: "fp-approved" });
      const before = await one("select * from content_packs where id = $1", [packId]);
      const err = await upsertPack({
        packId,
        intendedKnowledgeVersion: declared === "APPROVED" ? "KB-2026-10-01-901" : null,
        status: declared,
        packFingerprint: "fp-other",
        recordsFingerprint: "records-fp-CHANGED",
      });
      expect(err).toMatch(/PACK_CONTENT_CHANGED/);
      expect(await one("select * from content_packs where id = $1", [packId])).toEqual(before);
    });
  }

  it("re-registering identical content is a no-op, not an error", async () => {
    const packId = "RPC-PACK-upsert-4";
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-902", status: "APPROVED", packFingerprint: "fp-same" });
    const result = await one("select public.upsert_content_pack($1::jsonb) as r", [
      JSON.stringify({
        now: "2026-10-01T00:00:00+08:00", packId, formatVersion: "1.0", sourceRegistryVersion: "SR-1", importedBy: "TEST",
        recordsFingerprint: "records-fp", intendedKnowledgeVersion: "KB-2026-10-01-902", status: "APPROVED", packFingerprint: "fp-same", ...PACK_REVIEW,
      }),
    ]);
    expect(result?.r).toEqual({ action: "unchanged" });
  });

  it("an APPROVED pack is not demoted by a later NEEDS_REVIEW import of the same content", async () => {
    const packId = "RPC-PACK-upsert-5";
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-903", status: "APPROVED", packFingerprint: "fp-approved" });
    expect(await upsertPack({ packId, intendedKnowledgeVersion: null, status: "NEEDS_REVIEW", packFingerprint: "fp-needs-review" })).toBeNull();
    const row = await one("select status, reviewed_by, pack_fingerprint from content_packs where id = $1", [packId]);
    expect(row).toMatchObject({ status: "APPROVED", reviewed_by: "Jerry", pack_fingerprint: "fp-approved" });
  });

  // D-16c：imported_at／imported_by 是首次登錄（含回填）的時間與執行者，冪等重跑與升級都不覆寫。
  it("keeps the first imported_at / imported_by across an idempotent rerun and a NEEDS_REVIEW -> APPROVED promotion", async () => {
    const packId = "RPC-PACK-first-import";
    await upsertPack({ packId, intendedKnowledgeVersion: null, status: "NEEDS_REVIEW", packFingerprint: "fp-nr", importedBy: "OP-FIRST", now: "2026-10-01T00:00:00+08:00" });
    const first = await one("select imported_at, imported_by from content_packs where id = $1", [packId]);

    expect(await upsertPack({ packId, intendedKnowledgeVersion: null, status: "NEEDS_REVIEW", packFingerprint: "fp-nr", importedBy: "OP-SECOND", now: "2026-10-02T00:00:00+08:00" })).toBeNull();
    expect(await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-904", status: "APPROVED", packFingerprint: "fp-ap", importedBy: "OP-THIRD", now: "2026-10-03T00:00:00+08:00" })).toBeNull();
    expect(await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-904", status: "APPROVED", packFingerprint: "fp-ap", importedBy: "OP-FOURTH", now: "2026-10-04T00:00:00+08:00" })).toBeNull();

    const row = await one("select status, imported_at, imported_by from content_packs where id = $1", [packId]);
    expect(row).toMatchObject({ status: "APPROVED", imported_by: "OP-FIRST" });
    expect(row?.imported_at).toEqual(first?.imported_at);
  });

  it("an APPROVED pack keeps its existing reviewer / review time when a later call carries a different review", async () => {
    const packId = "RPC-PACK-keep-review";
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-905", status: "APPROVED", packFingerprint: "fp-ap" });
    const before = await one("select * from content_packs where id = $1", [packId]);

    const err = await upsertPack({
      packId, intendedKnowledgeVersion: "KB-2026-10-01-905", status: "APPROVED", packFingerprint: "fp-ap",
      reviewedBy: "Someone else", reviewedAt: "2026-10-03T09:00:00+08:00", importedBy: "OP-OTHER", now: "2026-10-05T00:00:00+08:00",
    });

    expect(err).toBeNull();
    expect(await one("select * from content_packs where id = $1", [packId])).toEqual(before);
  });
});

describe("backfill_record_review_event (DATA_MODEL §26c, Jerry 2026-10-03 item 2)", () => {
  async function addRecord(status: string, fingerprint: string) {
    await ensureSource();
    const id = `RPC-REV-${++seq}`;
    await query(
      `insert into knowledge_records (id, source_id, title, category, jurisdiction, source_url, effective_from, effective_to,
        fetched_at, last_verified_at, content_hash, status, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id, content_fingerprint)
       values ($1, 'RPC-SRC', 't', 'BENEFIT', 'TAIWAN', 'https://1966.gov.tw/', '2026-01-01', null, now(), now(), 'h', $2, 'raw', 's', '{}'::jsonb, now(), now(), 'P', $1, $3)`,
      [id, status, fingerprint]
    );
    return id;
  }
  const backfill = async (recordId: string, contentFingerprint: string, eventId: string) =>
    (
      await one("select public.backfill_record_review_event($1::jsonb) as r", [
        JSON.stringify({ recordId, contentFingerprint, eventId, reviewedBy: "Jerry", reviewedAt: "2026-09-24T09:52:27+08:00", reason: null, now: "2026-10-03T00:00:00+08:00" }),
      ])
    )?.r as { inserted: boolean };

  it("writes one CLI_PACK event with the reviewer and review time from the pack (not now) for a PUBLISHED record; idempotent", async () => {
    const id = await addRecord("PUBLISHED", "fp-pub");
    expect(await backfill(id, "fp-pub", "EV-1")).toEqual({ inserted: true });
    expect(await backfill(id, "fp-pub", "EV-2")).toEqual({ inserted: false });
    const events = (await query("select decision, reviewed_by, reviewed_at, source, content_fingerprint from knowledge_record_review_events where knowledge_record_id = $1", [id]))
      .rows as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ decision: "APPROVED", reviewed_by: "Jerry", source: "CLI_PACK", content_fingerprint: "fp-pub" });
    expect(new Date(events[0].reviewed_at as string).toISOString()).toBe("2026-09-24T01:52:27.000Z");
    const record = await one("select status, summary from knowledge_records where id = $1", [id]);
    expect(record).toEqual({ status: "PUBLISHED", summary: "s" }); // record not changed
  });

  it("refuses to fabricate evidence for a record that was never approved or whose content differs", async () => {
    const draft = await addRecord("NEEDS_REVIEW", "fp-draft");
    const approved = await addRecord("APPROVED", "fp-current");
    expect(await backfill(draft, "fp-draft", "EV-3")).toEqual({ inserted: false });
    expect(await backfill(approved, "fp-old-content", "EV-4")).toEqual({ inserted: false });
    expect(await one("select count(*)::int as n from knowledge_record_review_events")).toEqual({ n: 0 });
  });
});

describe("compute_publish_plan / admin_publish_knowledge_version (B-012-r3)", () => {
  it("computes a publishable plan once a candidate record's pack is registered as APPROVED", async () => {
    await ensureSource();
    const packId = "RPC-PACK-plan-1";
    const recId = await addApprovedRecord(packId);
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-910", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-plan-1" });

    const plan = (await one("select public.compute_publish_plan() as plan"))?.plan as Record<string, unknown>;
    expect(plan.canPublish).toBe(true);
    expect(plan.targetVersionId).toBe("KB-2026-10-01-910");
    expect((plan.blockers as unknown[])).toEqual([]);
    expect((plan.newRecords as Array<{ id: string }>).map((r) => r.id)).toContain(recId);
  });

  it("reports PACK_NOT_APPROVED when an APPROVED record's pack has not been registered", async () => {
    await ensureSource();
    await addApprovedRecord("RPC-PACK-unregistered");

    const plan = (await one("select public.compute_publish_plan() as plan"))?.plan as Record<string, unknown>;
    expect(plan.canPublish).toBe(false);
    expect((plan.blockers as Array<{ code: string }>).map((b) => b.code)).toContain("PACK_NOT_APPROVED");
  });

  it("publishes atomically: acquires the lock, recomputes, matches, delegates to publish_knowledge_version, and writes an audit event", async () => {
    await ensureSource();
    await query(`insert into internal_operators (id, display_name, roles, key_hash, active, created_at)
      values ('RPC-OP', 'RPC Test Operator', '{admin}', 'rpc-op-key-hash', true, now()) on conflict (id) do nothing`);

    const packId = "RPC-PACK-publish-1";
    const recId = await addApprovedRecord(packId);
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-920", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-publish-1" });
    const plan = (await one("select public.compute_publish_plan() as plan"))?.plan as Record<string, unknown>;
    expect(plan.canPublish).toBe(true);

    const err = await fails("select public.admin_publish_knowledge_version($1::jsonb)", [
      JSON.stringify({
        versionId: plan.targetVersionId,
        previewToken: plan.previewToken,
        operatorId: "RPC-OP",
        auditId: "RPC-AUDIT-1",
        now: "2026-10-01T00:00:00+08:00",
      }),
    ]);
    expect(err).toBeNull();

    const published = await one("select status from knowledge_records where id = $1", [recId]);
    expect(published?.status).toBe("PUBLISHED");
    const audit = await one("select action from admin_audit_events where id = 'RPC-AUDIT-1'");
    expect(audit?.action).toBe("KNOWLEDGE_VERSION_PUBLISHED");
  });

  it("rejects a mismatched previewToken with STATE_CHANGED and writes nothing", async () => {
    await ensureSource();
    await query(`insert into internal_operators (id, display_name, roles, key_hash, active, created_at)
      values ('RPC-OP-2', 'RPC Test Operator 2', '{admin}', 'rpc-op2-key-hash', true, now()) on conflict (id) do nothing`);

    const packId = "RPC-PACK-publish-2";
    const recId = await addApprovedRecord(packId);
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-921", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-publish-2" });
    const plan = (await one("select public.compute_publish_plan() as plan"))?.plan as Record<string, unknown>;

    const err = await fails("select public.admin_publish_knowledge_version($1::jsonb)", [
      JSON.stringify({
        versionId: plan.targetVersionId,
        previewToken: "PPV-stale-bogus-token",
        operatorId: "RPC-OP-2",
        auditId: "RPC-AUDIT-2",
        now: "2026-10-01T00:00:00+08:00",
      }),
    ]);
    expect(err).toMatch(/STATE_CHANGED/);

    const stillApproved = await one("select status from knowledge_records where id = $1", [recId]);
    expect(stillApproved?.status).toBe("APPROVED");
    const audit = await one("select action from admin_audit_events where id = 'RPC-AUDIT-2'");
    expect(audit).toBeUndefined();
  });

  it("rejects with VALIDATION_ERROR when recompute finds a blocker before writing (fresh database: no APPROVED records at all)", async () => {
    await query(`insert into internal_operators (id, display_name, roles, key_hash, active, created_at)
      values ('RPC-OP-3', 'RPC Test Operator 3', '{admin}', 'rpc-op3-key-hash', true, now())`);
    const err = await fails("select public.admin_publish_knowledge_version($1::jsonb)", [
      JSON.stringify({
        versionId: "KB-DOES-NOT-EXIST-999",
        previewToken: "PPV-irrelevant",
        operatorId: "RPC-OP-3",
        auditId: "RPC-AUDIT-3",
        now: "2026-10-01T00:00:00+08:00",
      }),
    ]);
    expect(err).toMatch(/^VALIDATION_ERROR:/);
    const audit = await one("select action from admin_audit_events where id = 'RPC-AUDIT-3'");
    expect(audit).toBeUndefined();
  });
});
