import { describe, it, expect } from "vitest";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { RawContentPack } from "../src/types/index.js";

const REGISTRY_MD = `
# Sources

| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| \`SRC-LAW-001\` | 長照辦法 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/x | v1 | OK | true |
| \`SRC-INACTIVE\` | 停用來源 | \`MOHW\` | \`TAIWAN\` | https://1966.gov.tw/x | v1 | OK | false |
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

    const report = await importContentPack(repo, validPack(), registry, { mode: "commit" });

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

    await importContentPack(repo, pack, registry, { mode: "commit" });

    expect(repo.records[0].status).toBe("NEEDS_REVIEW");
  });

  it("rejects (does not import) a record whose sourceId is not in the registry", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ source: { ...validRecord().source, sourceId: "SRC-UNKNOWN" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });

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

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/active=false/);
  });

  it("rejects a record whose source.url is not a gov.tw/gov.taipei domain", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ source: { ...validRecord().source, url: "https://example.com/page" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/白名單網域/);
  });

  it("rejects a record with an invalid contentHash format", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ source: { ...validRecord().source, contentHash: "not-a-hash" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/contentHash/);
  });

  it("APPROVED status requires review.reviewedBy and review.reviewedAt", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ status: "APPROVED", review: { reviewedBy: null, reviewedAt: null, decision: "APPROVED", notes: null } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });
    expect(report.recordsRejected[0].reasons.join(" ")).toMatch(/reviewedBy/);
  });

  it("any single rejected record blocks the entire pack (nothing is written)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([
      validRecord({ recordId: "KR-2026-001" }),
      validRecord({ recordId: "KR-2026-002", title: "第二筆", category: "BENEFIT", source: { ...validRecord().source, sourceId: "SRC-UNKNOWN" } }),
    ]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });
    expect(report.recordsValid).toBe(0);
    expect(repo.records).toHaveLength(0);
  });

  it("dry-run never writes, even for a fully valid pack", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);

    const report = await importContentPack(repo, validPack(), registry, { mode: "dry-run" });

    expect(report.written).toBe(false);
    expect(report.recordsValid).toBe(1);
    expect(repo.records).toHaveLength(0);
  });

  it("idempotent: re-importing the same pack does not duplicate records", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack();

    await importContentPack(repo, pack, registry, { mode: "commit" });
    const second = await importContentPack(repo, pack, registry, { mode: "commit" });

    expect(repo.records).toHaveLength(1);
    expect(second.recordsValid).toBe(0);
    expect(second.written).toBe(false);
  });

  it("REJECTED pack records are never imported into the database", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const registry = parseSourceRegistry(REGISTRY_MD);
    const pack = validPack([validRecord({ status: "REJECTED", review: { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "REJECTED", notes: "no" } })]);

    const report = await importContentPack(repo, pack, registry, { mode: "commit" });
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

    const report = await importContentPack(repo, validPack(), registry, { mode: "commit" });

    expect(report.written).toBe(true);
    const imported = repo.records.find((r) => r.packId === "KP-2026-09-23-001");
    expect(imported?.status).toBe("CONFLICT");
  });
});
