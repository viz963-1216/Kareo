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
const upsertPack = (input: Record<string, unknown>) =>
  fails("select public.upsert_content_pack($1::jsonb)", [JSON.stringify({ now: "2026-10-01T00:00:00+08:00", ...input })]);

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

describe("upsert_content_pack (B-012-r3)", () => {
  it("registers a new pack and allows NEEDS_REVIEW corrections under the same packId", async () => {
    const packId = "RPC-PACK-upsert-1";
    expect(await upsertPack({ packId, intendedKnowledgeVersion: null, sourceRegistryVersion: "SR-1", status: "NEEDS_REVIEW", packFingerprint: "fp-1" })).toBeNull();
    expect(await upsertPack({ packId, intendedKnowledgeVersion: null, sourceRegistryVersion: "SR-1", status: "NEEDS_REVIEW", packFingerprint: "fp-2-corrected" })).toBeNull();
    const row = await one("select status, pack_fingerprint from content_packs where id = $1", [packId]);
    expect(row).toMatchObject({ status: "NEEDS_REVIEW", pack_fingerprint: "fp-2-corrected" });
  });

  it("allows promoting NEEDS_REVIEW -> APPROVED in the same step as a content correction", async () => {
    const packId = "RPC-PACK-upsert-2";
    await upsertPack({ packId, intendedKnowledgeVersion: null, sourceRegistryVersion: "SR-1", status: "NEEDS_REVIEW", packFingerprint: "fp-1" });
    const err = await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-900", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-2-approved" });
    expect(err).toBeNull();
    const row = await one("select status from content_packs where id = $1", [packId]);
    expect(row?.status).toBe("APPROVED");
  });

  it("rejects swapping an already-APPROVED pack's content under the same packId", async () => {
    const packId = "RPC-PACK-upsert-3";
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-901", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-approved" });
    const err = await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-901", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-sneaky" });
    expect(err).toMatch(/PACK_CONTENT_CHANGED/);
    const row = await one("select pack_fingerprint from content_packs where id = $1", [packId]);
    expect(row?.pack_fingerprint).toBe("fp-approved"); // untouched
  });

  it("re-registering with the identical fingerprint is a no-op, not an error", async () => {
    const packId = "RPC-PACK-upsert-4";
    await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-902", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-same" });
    const err = await upsertPack({ packId, intendedKnowledgeVersion: "KB-2026-10-01-902", sourceRegistryVersion: "SR-1", status: "APPROVED", packFingerprint: "fp-same" });
    expect(err).toBeNull();
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
