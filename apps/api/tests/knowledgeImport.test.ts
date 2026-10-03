import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { RawContentPack } from "../src/types/index.js";

const REGISTRY_MD = `
# Sources

| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| \`SRC-LAW-001\` | 長照辦法 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/x | v1 | OK | true |
| \`SRC-INACTIVE\` | 停用來源 | \`MOHW\` | \`TAIWAN\` | https://1966.gov.tw/x | v1 | OK | false |
| \`SRC-DRIVE-NTPC-AD-TOPUP\` | 新北市輔具加碼 | \`KAREO_DRIVE\` | \`NEW_TAIPEI\` | https://drive.google.com/file/d/1V_dZRAeeUGYLKR_JrFFUg2g0un4nFmh5/view | v1 | OK | true |
`;

function validRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    recordId: "KR-2026-001",
    category: "ELIGIBILITY",
    jurisdiction: "TAIWAN",
    title: "長照服務對象",
    source: {
      sourceId: "SRC-LAW-001",
      authority: "LAW",
      url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059",
      fetchedAt: "2026-09-23T10:00:00+08:00",
      contentHash: "sha256:" + "a".repeat(64),
    },
    publishedAt: "2026-06-19",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    lastVerifiedAt: "2026-09-23T10:00:00+08:00",
    excerpt: "條文摘錄",
    summary: "長照服務對象摘要",
    ruleData: { minAge: 65 },
    status: "NEEDS_REVIEW",
    review: { reviewedBy: null, reviewedAt: null, decision: null, notes: null },
    ...overrides,
  };
}

function validPack(records = [validRecord()]): RawContentPack {
  return {
    packId: "KP-2026-09-23-001",
    formatVersion: "1.0",
    createdAt: "2026-09-23T09:00:00+08:00",
    createdBy: "Jerry",
    sourceRegistryVersion: "SR-2026-09-23-01",
    status: "NEEDS_REVIEW",
    review: { reviewedBy: null, reviewedAt: null, decision: null, notes: null },
    intendedKnowledgeVersion: null,
    records,
  };
}

describe("parseSourceRegistry", () => {
  it("parses active and inactive sources from a markdown table", () => {
    const registry = parseSourceRegistry(REGISTRY_MD);
    expect(registry.get("SRC-LAW-001")).toEqual({
      authority: "LAW",
      jurisdiction: "TAIWAN",
      url: "https://law.moj.gov.tw/x",
      active: true,
    });
    expect(registry.get("SRC-INACTIVE")?.active).toBe(false);
  });
});

describe("importContentPack", () => {
  it("commit: a fully valid pack is written with DB status NEEDS_REVIEW regardless of pack status", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);

    const report = await importContentPack(repo, validPack(), registry, { mode: "commit", importedBy: "TEST" });

    expect(report.written).toBe(true);
    expect(report.recordsValid).toBe(1);
    expect(report.recordsRejected).toHaveLength(0);
    expect(repo.records).toHaveLength(1);
    expect(repo.records[0].status).toBe("NEEDS_REVIEW");
    expect(repo.records[0].packId).toBe("KP-2026-09-23-001");
    expect(repo.records[0].packRecordId).toBe("KR-2026-001");
  });

  it("even an APPROVED pack record becomes NEEDS_REVIEW in the database (import != database approval)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([
      validRecord({ status: "APPROVED", review: { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "APPROVED", notes: null } }),
    ]);

    await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });

    expect(repo.records[0].status).toBe("NEEDS_REVIEW");
  });

  it("rejects (does not import) a record whose sourceId is not in the registry", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ source: { ...validRecord().source, sourceId: "SRC-UNKNOWN" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });

    expect(report.written).toBe(false);
    expect(report.recordsRejected).toHaveLength(1);
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/不存在於 source-registry/);
    expect(repo.records).toHaveLength(0);
  });

  it("rejects a record whose sourceId is inactive in the registry", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([
      validRecord({
        source: { sourceId: "SRC-INACTIVE", authority: "MOHW", url: "https://1966.gov.tw/x", fetchedAt: "2026-09-23T10:00:00+08:00", contentHash: "sha256:" + "b".repeat(64) },
      }),
    ]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/active=false/);
  });

  it("rejects a record whose source.url is not a gov.tw/gov.taipei domain", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ source: { ...validRecord().source, url: "https://example.com/page" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/白名單網域/);
  });

  it("rejects a record with an invalid contentHash format", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ source: { ...validRecord().source, contentHash: "not-a-hash" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/contentHash/);
  });

  it("APPROVED status requires review.reviewedBy and review.reviewedAt", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ status: "APPROVED", review: { reviewedBy: null, reviewedAt: null, decision: "APPROVED", notes: null } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/reviewedBy/);
  });

  it("any single rejected record blocks the entire pack (nothing is written)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([
      validRecord({ recordId: "KR-2026-001" }),
      validRecord({ recordId: "KR-2026-002", title: "第二筆", category: "BENEFIT", source: { ...validRecord().source, sourceId: "SRC-UNKNOWN" } }),
    ]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsValid).toBe(0);
    expect(repo.records).toHaveLength(0);
  });

  it("dry-run never writes, even for a fully valid pack", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);

    const report = await importContentPack(repo, validPack(), registry, { mode: "dry-run", importedBy: "TEST" });

    expect(report.written).toBe(false);
    expect(report.recordsValid).toBe(1);
    expect(repo.records).toHaveLength(0);
  });

  it("idempotent: re-importing the same pack does not duplicate records", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack();

    await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    const second = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });

    expect(repo.records).toHaveLength(1);
    expect(second.recordsValid).toBe(0);
    expect(second.written).toBe(false);
  });

  it("REJECTED pack records are never imported into the database", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ status: "REJECTED", review: { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "REJECTED", notes: "no" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsValid).toBe(0);
    expect(repo.records).toHaveLength(0);
  });

  it("flags CONFLICT when a new record's content differs from an existing PUBLISHED record with the same jurisdiction+category+title", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);

    // 先塞一筆已發布的紀錄
    repo.records.push({
      id: "KREC-EXISTING",
      sourceId: "SRC-LAW-001",
      title: "長照服務對象",
      category: "ELIGIBILITY",
      jurisdiction: "TAIWAN",
      sourceUrl: "https://law.moj.gov.tw/x",
      publishedAt: "2026-01-01",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      fetchedAt: "2026-01-01T00:00:00+08:00",
      lastVerifiedAt: "2026-01-01T00:00:00+08:00",
      contentHash: "sha256:" + "0".repeat(64),
      contentFingerprint: "sha256:" + "0".repeat(64),
      status: "PUBLISHED",
      version: "KB-2026-01-01-001",
      rawText: "old",
      summary: "old",
      ruleData: {},
      createdAt: "2026-01-01T00:00:00+08:00",
      updatedAt: "2026-01-01T00:00:00+08:00",
      packId: "KP-OLD",
      packRecordId: "KR-OLD-001",
    });

    const report = await importContentPack(repo, validPack(), registry, { mode: "commit", importedBy: "TEST" });

    expect(report.written).toBe(true);
    const imported = repo.records.find((r) => r.packId === "KP-2026-09-23-001");
    expect(imported?.status).toBe("CONFLICT");
  });
});

describe("KAREO_DRIVE source (D-15, B-008-r2)", () => {
  const driveRecord = (overrides: Partial<Record<string, unknown>> = {}) =>
    validRecord({
      source: {
        sourceId: "SRC-DRIVE-NTPC-AD-TOPUP",
        authority: "KAREO_DRIVE",
        url: "https://drive.google.com/file/d/1V_dZRAeeUGYLKR_JrFFUg2g0un4nFmh5/view",
        fetchedAt: "2026-09-24T10:00:00+08:00",
        contentHash: "sha256:" + "c".repeat(64),
      },
      ...overrides,
    });

  it("imports a record whose sourceId is registered as KAREO_DRIVE with a valid drive.google.com URL", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const report = await importContentPack(repo, validPack([driveRecord()]), registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected).toEqual([]);
    expect(report.recordsValid).toBe(1);
  });

  it("rejects a KAREO_DRIVE record whose URL is not a drive.google.com/file/d/... link", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([driveRecord({ source: { ...driveRecord().source as object, url: "https://1966.gov.tw/x" } })]);
    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected).toHaveLength(1);
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/KAREO_DRIVE 來源須為/);
  });

  it("rejects a KAREO_DRIVE sourceId that is not registered in source-registry.md", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([
      driveRecord({ source: { ...driveRecord().source as object, sourceId: "SRC-DRIVE-UNREGISTERED" } }),
    ]);
    const report = await importContentPack(repo, pack, registry, { mode: "commit", importedBy: "TEST" });
    expect(report.recordsRejected).toHaveLength(1);
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/不存在於 source-registry/);
  });
});

// D-16c：已提交內容不可改寫的規則也適用尚未登錄 content_packs 的舊資料（B-012 上線前匯入、回填因內容
// 不符而未登錄的內容包）。這組測試在第一次匯入後清掉登錄，模擬這種舊資料；已登錄的內容包見下方 B-012 組。
function simulateLegacyUnregistered(repo: InMemoryKnowledgeRepository): void {
  repo.contentPacks.length = 0;
}

describe("D-16c: legacy (unregistered) packs are immutable too — same (packId, recordId) with different content is rejected", () => {
  it("same content re-imported twice: idempotent, no duplicate row", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, validPack(), registry, { mode: "commit", importedBy: "TEST" });
    simulateLegacyUnregistered(repo);
    const second = await importContentPack(repo, validPack(), registry, { mode: "commit", importedBy: "TEST" });

    expect(second.recordsRejected).toEqual([]);
    expect(second.recordsValid).toBe(0);
    expect(repo.records.filter((r) => r.packId === "KP-2026-09-23-001")).toHaveLength(1);
  });

  const cases = [
    { label: "NEEDS_REVIEW", dbStatus: "NEEDS_REVIEW" as const },
    { label: "APPROVED", dbStatus: "APPROVED" as const },
    { label: "PUBLISHED", dbStatus: "PUBLISHED" as const },
  ];
  for (const { label, dbStatus } of cases) {
    it(`changed content on a legacy ${label} record is rejected; the record and its status are untouched (was: toCorrect)`, async () => {
      const repo = new InMemoryKnowledgeRepository();
      const registry = parseSourceRegistry(REGISTRY_MD);
      await importContentPack(repo, validPack([validRecord({ summary: "舊版摘要" })]), registry, { mode: "commit", importedBy: "TEST" });
      simulateLegacyUnregistered(repo);
      repo.records[0].status = dbStatus;
      if (dbStatus === "PUBLISHED") repo.records[0].version = "KB-2026-09-25-001";
      const before = { ...repo.records[0] };

      const corrected = validRecord({
        summary: "修正後摘要",
        source: { ...validRecord().source, contentHash: "sha256:" + "b".repeat(64) },
      });
      const report = await importContentPack(repo, validPack([corrected]), registry, { mode: "commit", importedBy: "TEST" });

      expect(report.written).toBe(false);
      expect(report.recordsRejected).toHaveLength(1);
      expect(report.recordsRejected[0].recordId).toBe("KR-2026-001");
      const reason = report.recordsRejected[0].reasons.join(" ");
      expect(reason).toMatch(/RECORD_CONTENT_CHANGED/);
      expect(reason).toContain(before.contentFingerprint); // 列出差異：資料庫現有指紋
      expect(reason).toMatch(/新的 packId／recordId/);
      expect(repo.records).toHaveLength(1);
      expect(repo.records[0]).toEqual(before);
      expect(repo.contentPacks).toHaveLength(0); // 不登錄跟資料庫不一致的內容包
    });
  }

  it("dry-run reports the same rejection and writes nothing", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, validPack([validRecord({ summary: "舊版摘要" })]), registry, { mode: "commit", importedBy: "TEST" });
    simulateLegacyUnregistered(repo);
    const before = { ...repo.records[0] };

    const report = await importContentPack(repo, validPack([validRecord({ summary: "修正後摘要" })]), registry, { mode: "dry-run", importedBy: null });

    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/RECORD_CONTENT_CHANGED/);
    expect(repo.records[0]).toEqual(before);
  });
});

// D-16c：commit 必須帶已驗證的操作者；dry-run 不需要、也不建立任何稽核。
describe("D-16c: importedBy is the verified operator", () => {
  it("commit without an operator is refused before any repository access", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    for (const importedBy of [null, "", "   "]) {
      await expect(importContentPack(repo, validPack(), registry, { mode: "commit", importedBy })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(repo.records).toHaveLength(0);
    expect(repo.contentPacks).toHaveLength(0);
  });

  it("dry-run without an operator validates and writes nothing", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const report = await importContentPack(repo, validPack(), registry, { mode: "dry-run", importedBy: null });
    expect(report.recordsValid).toBe(1);
    expect(repo.records).toHaveLength(0);
    expect(repo.contentPacks).toHaveLength(0);
  });

  it("re-runs keep the first importedAt/importedBy (idempotent rerun and NEEDS_REVIEW -> APPROVED promotion)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const record = validRecord({ status: "APPROVED", review: RECORD_REVIEW });
    await importContentPack(repo, validPack([record]), registry, { mode: "commit", importedBy: "OP-FIRST" });
    const first = { ...(await repo.findContentPackById("KP-2026-09-23-001"))! };
    await new Promise((resolve) => setTimeout(resolve, 5));

    await importContentPack(repo, validPack([record]), registry, { mode: "commit", importedBy: "OP-SECOND" });
    await importContentPack(repo, approvedPack([record]), registry, { mode: "commit", importedBy: "OP-THIRD" });
    await importContentPack(repo, approvedPack([record]), registry, { mode: "commit", importedBy: "OP-FOURTH" });
    const after = await repo.findContentPackById("KP-2026-09-23-001");

    expect(after?.status).toBe("APPROVED");
    expect(after?.importedBy).toBe("OP-FIRST");
    expect(after?.importedAt).toBe(first.importedAt);
  });

  it("an APPROVED pack keeps its existing reviewer/time when the file's review is edited later", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, approvedPack(), registry, { mode: "commit", importedBy: "OP-FIRST" });
    const before = await repo.findContentPackById("KP-2026-09-23-001");

    const edited = { ...approvedPack(), review: { ...PACK_REVIEW, reviewedBy: "Someone else", reviewedAt: "2026-10-03T09:00:00+08:00" } };
    const report = await importContentPack(repo, edited, registry, { mode: "commit", importedBy: "OP-SECOND" });

    expect(report.recordsRejected).toEqual([]);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toEqual(before);
  });

  it("a registered pack whose REJECTED record content changed is rejected (REJECTED records are part of the fingerprint)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const rejectedReview = { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "REJECTED", notes: "no" };
    const kept = validRecord();
    const rejected = validRecord({ recordId: "KR-2026-002", title: "拒收紀錄", status: "REJECTED", review: rejectedReview });
    await importContentPack(repo, validPack([kept, rejected]), registry, { mode: "commit", importedBy: "TEST" });
    const packBefore = await repo.findContentPackById("KP-2026-09-23-001");

    const editedRejected = validRecord({ recordId: "KR-2026-002", title: "拒收紀錄", summary: "改過的拒收內容", status: "REJECTED", review: rejectedReview });
    const report = await importContentPack(repo, validPack([kept, editedRejected]), registry, { mode: "commit", importedBy: "TEST" });

    expect(report.written).toBe(false);
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/PACK_CONTENT_CHANGED/);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toEqual(packBefore);
  });
});

// DATA_MODEL §26b：匯入時把內容包層級資料（含內容包 review 與匯入證據）登錄進 content_packs；
// 已登錄的內容包身分固定，同一 packId 內容有變一律拒絕（Jerry 2026-10-03 審查第 3 點）。
const PACK_REVIEW = { reviewedBy: "Jerry", reviewedAt: "2026-09-24T09:52:27+08:00", decision: "APPROVED", notes: null };
const RECORD_REVIEW = { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "APPROVED", notes: null };
function approvedPack(records = [validRecord({ status: "APPROVED", review: RECORD_REVIEW })]): RawContentPack {
  return { ...validPack(records), status: "APPROVED", review: PACK_REVIEW, intendedKnowledgeVersion: "KB-2026-10-01-001" };
}

describe("B-012: importContentPack registers content_packs (DATA_MODEL §26b)", () => {
  it("registers a new pack with format version, review and import evidence", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, approvedPack(), registry, { mode: "commit", importedBy: "TEST" });

    const pack = await repo.findContentPackById("KP-2026-09-23-001");
    expect(pack).toMatchObject({
      status: "APPROVED",
      formatVersion: "1.0",
      intendedKnowledgeVersion: "KB-2026-10-01-001",
      reviewedBy: "Jerry",
      reviewedAt: "2026-09-24T09:52:27+08:00",
      reviewDecision: "APPROVED",
      importedBy: "TEST",
    });
    expect(pack?.packFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pack?.recordsFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pack?.importedAt).toBeTruthy();
  });

  it("a NEEDS_REVIEW pack with an empty review registers as NEEDS_REVIEW with null review fields", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, validPack(), registry, { mode: "commit", importedBy: "TEST" });

    const pack = await repo.findContentPackById("KP-2026-09-23-001");
    expect(pack).toMatchObject({ status: "NEEDS_REVIEW", reviewedBy: null, reviewedAt: null, reviewDecision: null });
  });

  it("same content: NEEDS_REVIEW -> APPROVED promotion is allowed and persists the pack review", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const record = validRecord({ status: "APPROVED", review: RECORD_REVIEW });
    await importContentPack(repo, validPack([record]), registry, { mode: "commit", importedBy: "TEST" });
    const before = await repo.findContentPackById("KP-2026-09-23-001");

    const report = await importContentPack(repo, approvedPack([record]), registry, { mode: "commit", importedBy: "TEST" });
    const after = await repo.findContentPackById("KP-2026-09-23-001");

    expect(report.recordsRejected).toEqual([]);
    expect(after).toMatchObject({ status: "APPROVED", reviewedBy: "Jerry", reviewDecision: "APPROVED", intendedKnowledgeVersion: "KB-2026-10-01-001" });
    expect(after?.recordsFingerprint).toBe(before?.recordsFingerprint);
    expect(after?.packFingerprint).not.toBe(before?.packFingerprint); // §26b packFingerprint includes status and version
  });

  it("re-importing the same APPROVED pack is idempotent", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, approvedPack(), registry, { mode: "commit", importedBy: "TEST" });
    const before = await repo.findContentPackById("KP-2026-09-23-001");

    const report = await importContentPack(repo, approvedPack(), registry, { mode: "commit", importedBy: "TEST" });
    const after = await repo.findContentPackById("KP-2026-09-23-001");

    expect(report.recordsRejected).toEqual([]);
    expect(report.written).toBe(false);
    expect(after?.packFingerprint).toBe(before?.packFingerprint);
    expect(after?.status).toBe("APPROVED");
  });

  for (const declared of ["NEEDS_REVIEW", "APPROVED"] as const) {
    it(`registered pack + changed content (this import declares ${declared}) is rejected; nothing is written`, async () => {
      const repo = new InMemoryKnowledgeRepository();
      const registry = parseSourceRegistry(REGISTRY_MD);
      await importContentPack(repo, approvedPack(), registry, { mode: "commit", importedBy: "TEST" });
      const recordBefore = { ...repo.records[0] };
      const packBefore = await repo.findContentPackById("KP-2026-09-23-001");

      const changed = validRecord({
        summary: "改過的內容",
        status: declared === "APPROVED" ? "APPROVED" : "NEEDS_REVIEW",
        review: declared === "APPROVED" ? RECORD_REVIEW : { reviewedBy: null, reviewedAt: null, decision: null, notes: null },
      });
      const changedPack = declared === "APPROVED" ? approvedPack([changed]) : validPack([changed]);
      const report = await importContentPack(repo, changedPack, registry, { mode: "commit", importedBy: "TEST" });

      expect(report.written).toBe(false);
      expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/PACK_CONTENT_CHANGED/);
      expect(repo.records).toHaveLength(1);
      expect(repo.records[0]).toEqual(recordBefore);
      expect(await repo.findContentPackById("KP-2026-09-23-001")).toEqual(packBefore);
    });
  }

  it("Jerry 2026-10-03 item 3: importing the same changed content again is still rejected (no later promotion under the same packId)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, approvedPack(), registry, { mode: "commit", importedBy: "TEST" });
    const changedPack = approvedPack([validRecord({ summary: "改過的內容", status: "APPROVED", review: RECORD_REVIEW })]);

    const first = await importContentPack(repo, changedPack, registry, { mode: "commit", importedBy: "TEST" });
    const second = await importContentPack(repo, changedPack, registry, { mode: "commit", importedBy: "TEST" });

    expect(first.written).toBe(false);
    expect(second.written).toBe(false);
    expect(second.recordsRejected[0].reasons.join(" ")).toMatch(/PACK_CONTENT_CHANGED/);
    expect(repo.records[0].summary).toBe("長照服務對象摘要");
  });
});

// Jerry 2026-10-03 審查第 1 點：APPROVED 內容包必須有完整的內容包層級 review（content-pack.schema.json）。
describe("B-012: pack-level review is validated (not only the status string)", () => {
  const cases: Array<[string, Record<string, unknown> | undefined]> = [
    ["missing review", undefined],
    ["review.reviewedBy empty", { ...PACK_REVIEW, reviewedBy: "" }],
    ["review.reviewedAt invalid", { ...PACK_REVIEW, reviewedAt: "2026-09-24" }],
    ["review.decision not APPROVED", { ...PACK_REVIEW, decision: "REJECTED" }],
    ["review.decision null", { ...PACK_REVIEW, decision: null }],
  ];
  for (const [label, review] of cases) {
    it(`APPROVED pack with ${label} is rejected; nothing is written or registered`, async () => {
      const repo = new InMemoryKnowledgeRepository();
      const registry = parseSourceRegistry(REGISTRY_MD);
      const pack = approvedPack() as Record<string, unknown>;
      if (review === undefined) delete pack.review;
      else pack.review = review;

      const report = await importContentPack(repo, pack as RawContentPack, registry, { mode: "commit", importedBy: "TEST" });

      expect(report.written).toBe(false);
      expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/內容包.*review|內容包層級 review/);
      expect(repo.records).toHaveLength(0);
      expect(await repo.findContentPackById("KP-2026-09-23-001")).toBeNull();
    });
  }
});

describe("B-012: Jerry 2026-10-03 reproduction with the real KP-2026-09-23-001 pack", () => {
  const realRegistry = parseSourceRegistry(readFileSync("../../docs/knowledge/source-registry.md", "utf-8"));
  const realPack = (): RawContentPack => JSON.parse(readFileSync("../../contracts/knowledge/packs/KP-2026-09-23-001.json", "utf-8"));

  it("the real pack with its top-level review removed is rejected (was: 9 imported, content_packs APPROVED)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const pack = realPack() as Record<string, unknown>;
    delete pack.review;

    const report = await importContentPack(repo, pack as RawContentPack, realRegistry, { mode: "commit", importedBy: "TEST" });

    expect(report.written).toBe(false);
    expect(repo.records).toHaveLength(0);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toBeNull();
  });

  it("the real pack as approved imports 9 records and registers APPROVED with Jerry's pack review", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const report = await importContentPack(repo, realPack(), realRegistry, { mode: "commit", importedBy: "TEST" });

    expect(report.recordsValid).toBe(9);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toMatchObject({
      status: "APPROVED",
      reviewedBy: "Jerry",
      reviewedAt: "2026-09-24T09:52:27+08:00",
      reviewDecision: "APPROVED",
    });
  });
});
