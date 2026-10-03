// TASK-B-014：GET /api/v1/knowledge/records，依 docs/API_CONTRACT.md §13a。
import { describe, it, expect } from "vitest";
import { getKnowledgeRecords } from "../src/services/knowledgeRecordsService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { KnowledgeRecord } from "../src/types/index.js";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "KREC-001",
    sourceId: "SRC-LAW-001",
    title: "長照服務對象",
    category: "ELIGIBILITY",
    jurisdiction: "TAIWAN",
    sourceUrl: "https://law.moj.gov.tw/x",
    publishedAt: "2026-06-19",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    fetchedAt: "2026-09-23T10:00:00+08:00",
    lastVerifiedAt: "2026-09-23T10:00:00+08:00",
    contentHash: "sha256:" + "a".repeat(64),
    contentFingerprint: "sha256:" + "f".repeat(64),
    status: "PUBLISHED",
    version: "KB-2026-09-24-001",
    rawText: "text",
    summary: "summary",
    ruleData: {},
    createdAt: "2026-09-23T10:00:00+08:00",
    updatedAt: "2026-09-23T10:00:00+08:00",
    packId: "KP-2026-09-23-001",
    packRecordId: "KR-2026-001",
    ...overrides,
  };
}

const VERSION = "KB-2026-09-24-001";

// 建立「已發布」的記憶體狀態：versions／versionRecords／sourceAuthorities／sourceNames 都是
// publishVersion 以外的既有測試慣例所沒有直接操作的內部資料，這裡依 B-010 既有測試手法直接灌入。
function setupPublished(
  repo: InMemoryKnowledgeRepository,
  records: KnowledgeRecord[],
  opts: { sourceAuthority?: string; sourceName?: string } = {}
): void {
  repo.versions.push({
    id: VERSION,
    status: "PUBLISHED",
    publishedAt: "2026-09-24T12:00:00+08:00",
    createdBy: "OP-1",
    approvedBy: "OP-1",
    notes: null,
  });
  for (const r of records) {
    repo.records.push(r);
    const set = repo.versionRecords.get(VERSION) ?? new Set<string>();
    set.add(r.id);
    repo.versionRecords.set(VERSION, set);
  }
  repo.sourceAuthorities.set("SRC-LAW-001", (opts.sourceAuthority as never) ?? "LAW");
  repo.sourceNames.set("SRC-LAW-001", opts.sourceName ?? "長期照顧服務申請及給付辦法（條文）");
}

describe("getKnowledgeRecords", () => {
  it("no PUBLISHED version -> KNOWLEDGE_UNAVAILABLE", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(getKnowledgeRecords(repo, {})).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("returns items with only the 10 public fields, mapped correctly", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record()]);

    const result = await getKnowledgeRecords(repo, {});
    expect(result.knowledgeVersion).toBe(VERSION);
    expect(result.publishedAt).toBe("2026-09-24T12:00:00+08:00");
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(Object.keys(item).sort()).toEqual(
      ["id", "title", "category", "jurisdiction", "summary", "effectiveFrom", "effectiveTo", "publishedAt", "lastVerifiedAt", "source"].sort()
    );
    expect(Object.keys(item.source).sort()).toEqual(["title", "publisher", "url"].sort());
    expect(item.source.title).toBe("長期照顧服務申請及給付辦法（條文）");
    expect(item.source.publisher).toBe("全國法規資料庫");
    expect(item.source.url).toBe("https://law.moj.gov.tw/x");
    expect((item as unknown as Record<string, unknown>).ruleData).toBeUndefined();
    expect((item as unknown as Record<string, unknown>).status).toBeUndefined();
    expect((item as unknown as Record<string, unknown>).contentFingerprint).toBeUndefined();
  });

  it("excludes not-yet-effective, expired, and non-PUBLISHED records", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [
      record({ id: "KREC-FUTURE", effectiveFrom: "2099-01-01" }),
      record({ id: "KREC-EXPIRED", effectiveFrom: "2020-01-01", effectiveTo: "2020-12-31" }),
      record({ id: "KREC-CURRENT", effectiveFrom: "2026-01-01", effectiveTo: null }),
    ]);
    // 非 PUBLISHED（例如 SUPERSEDED）即使是版本成員也不應出現。
    const superseded = record({ id: "KREC-SUPERSEDED", status: "SUPERSEDED" });
    repo.records.push(superseded);
    repo.versionRecords.get(VERSION)!.add("KREC-SUPERSEDED");

    const result = await getKnowledgeRecords(repo, {});
    expect(result.items.map((i) => i.id)).toEqual(["KREC-CURRENT"]);
  });

  it("KAREO_DRIVE source: publisher uses ruleData.issuer, url is always null", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record({ sourceId: "SRC-DRIVE-001", ruleData: { issuer: "新北市政府社會局" } })]);
    repo.sourceAuthorities.set("SRC-DRIVE-001", "KAREO_DRIVE" as never);
    repo.sourceNames.set("SRC-DRIVE-001", "Jerry 指定資料夾文件");

    const result = await getKnowledgeRecords(repo, {});
    expect(result.items[0].source.publisher).toBe("新北市政府社會局");
    expect(result.items[0].source.url).toBeNull();
  });

  it("KAREO_DRIVE source without ruleData.issuer falls back to the source name, never leaves publisher empty", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record({ sourceId: "SRC-DRIVE-002" })]);
    repo.sourceAuthorities.set("SRC-DRIVE-002", "KAREO_DRIVE" as never);
    repo.sourceNames.set("SRC-DRIVE-002", "Jerry 指定資料夾文件");

    const result = await getKnowledgeRecords(repo, {});
    expect(result.items[0].source.publisher).toBe("Jerry 指定資料夾文件");
  });

  it("filters by jurisdiction and category", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [
      record({ id: "KREC-A", jurisdiction: "TAIWAN", category: "ELIGIBILITY" }),
      record({ id: "KREC-B", jurisdiction: "TAIPEI", category: "BENEFIT" }),
      record({ id: "KREC-C", jurisdiction: "NEW_TAIPEI", category: "BENEFIT" }),
    ]);

    const byJurisdiction = await getKnowledgeRecords(repo, { jurisdiction: "TAIPEI" });
    expect(byJurisdiction.items.map((i) => i.id)).toEqual(["KREC-B"]);
    expect(byJurisdiction.appliedFilters).toEqual({ jurisdiction: "TAIPEI", category: null, page: 1, pageSize: 20 });

    const byCategory = await getKnowledgeRecords(repo, { category: "BENEFIT" });
    expect(byCategory.items.map((i) => i.id).sort()).toEqual(["KREC-B", "KREC-C"]);
  });

  it("sorts by jurisdiction (TAIWAN -> TAIPEI -> NEW_TAIPEI), then category (DATA_MODEL §24 order), then id", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [
      record({ id: "KREC-Z", jurisdiction: "NEW_TAIPEI", category: "OTHER" }),
      record({ id: "KREC-Y", jurisdiction: "TAIWAN", category: "BENEFIT" }),
      record({ id: "KREC-X", jurisdiction: "TAIWAN", category: "ELIGIBILITY" }),
      record({ id: "KREC-W", jurisdiction: "TAIPEI", category: "BENEFIT" }),
      record({ id: "KREC-V", jurisdiction: "TAIWAN", category: "BENEFIT" }), // 同 jurisdiction+category，比 id
    ]);

    const result = await getKnowledgeRecords(repo, {});
    // 預期順序：TAIWAN/ELIGIBILITY(X) → TAIWAN/BENEFIT(V, Y 依 id 字母序) → TAIPEI/BENEFIT(W) → NEW_TAIPEI/OTHER(Z)
    expect(result.items.map((i) => i.id)).toEqual(["KREC-X", "KREC-V", "KREC-Y", "KREC-W", "KREC-Z"]);
  });

  it("paginates and reports totalCount across the full filtered set", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(
      repo,
      Array.from({ length: 25 }, (_, i) => record({ id: `KREC-${String(i).padStart(3, "0")}` }))
    );

    const page1 = await getKnowledgeRecords(repo, { pageSize: "10" });
    expect(page1.items).toHaveLength(10);
    expect(page1.totalCount).toBe(25);
    expect(page1.page).toBe(1);

    const page3 = await getKnowledgeRecords(repo, { page: "3", pageSize: "10" });
    expect(page3.items).toHaveLength(5);
  });

  it("empty result uses the empty-result notice; non-empty uses the default notice (always mentions 1966)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record({ jurisdiction: "TAIWAN" })]);

    const empty = await getKnowledgeRecords(repo, { jurisdiction: "TAIPEI" });
    expect(empty.totalCount).toBe(0);
    expect(empty.notice).toContain("1966");
    expect(empty.notice).toBe("目前沒有符合條件的已發布資訊。可調整篩選條件，或聯絡 1966 長照專線洽詢。");

    const nonEmpty = await getKnowledgeRecords(repo, {});
    expect(nonEmpty.notice).toContain("1966");
  });

  it("rejects unknown query parameters", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record()]);
    await expect(getKnowledgeRecords(repo, { foo: "bar" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects invalid jurisdiction / category / page / pageSize", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record()]);
    await expect(getKnowledgeRecords(repo, { jurisdiction: "KAOHSIUNG" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getKnowledgeRecords(repo, { category: "NOT_A_CATEGORY" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getKnowledgeRecords(repo, { page: "0" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getKnowledgeRecords(repo, { page: "1.5" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getKnowledgeRecords(repo, { pageSize: "51" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getKnowledgeRecords(repo, { pageSize: "0" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("never returns ruleData, excerpt/rawText, contentHash, contentFingerprint, status, packId, or review fields", async () => {
    const repo = new InMemoryKnowledgeRepository();
    setupPublished(repo, [record({ ruleData: { type: "ELIGIBILITY_ANY_OF", secretInternal: "x" } })]);

    const result = await getKnowledgeRecords(repo, {});
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secretInternal");
    expect(serialized).not.toContain("rawText");
    expect(serialized).not.toContain("contentHash");
    expect(serialized).not.toContain("contentFingerprint");
    expect(serialized).not.toContain("packId");
  });
});
