// TASK-B-012-r3（Jerry 指示 2）：「提供回填指令：讀 contracts/knowledge/packs/*.json，逐筆比對
// 資料庫內容指紋，一致才登錄。」模擬 B-012 上線前就已經匯入、資料庫裡已有紀錄但 content_packs
// 還沒有任何登錄的情境（不透過 importContentPack，直接灌資料庫，比照真實的「舊資料」）。
import { describe, it, expect } from "vitest";
import { runBackfillContentPacks } from "../src/scripts/backfillContentPacks.js";
import { computeContentFingerprint } from "../src/services/contentFingerprint.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { RawContentPack } from "../src/types/index.js";

function makePackAndDbRecord(overrides: { summary?: string; dbSummary?: string } = {}) {
  const fingerprintable = {
    sourceId: "SRC-LAW-001",
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059",
    title: "長照服務對象",
    category: "ELIGIBILITY",
    jurisdiction: "TAIWAN",
    publishedAt: "2026-06-19",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    rawText: "條文摘錄",
    summary: overrides.summary ?? "長照服務對象摘要",
    ruleData: { minAge: 65 },
  };
  const packRecord = {
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
    summary: overrides.summary ?? "長照服務對象摘要",
    ruleData: { minAge: 65 },
    status: "APPROVED",
    review: { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "APPROVED", notes: null },
  };
  const pack: RawContentPack = {
    packId: "KP-2026-09-23-001",
    formatVersion: "1.0",
    createdAt: "2026-09-23T09:00:00+08:00",
    createdBy: "Jerry",
    sourceRegistryVersion: "SR-2026-09-23-01",
    status: "APPROVED",
    review: { reviewedBy: "Jerry", reviewedAt: "2026-09-23T09:00:00+08:00", decision: "APPROVED", notes: null },
    intendedKnowledgeVersion: "KB-2026-09-23-001",
    records: [packRecord],
  } as RawContentPack;

  const dbFingerprintable = { ...fingerprintable, summary: overrides.dbSummary ?? overrides.summary ?? "長照服務對象摘要" };
  const dbRecord = {
    id: "KREC-001",
    sourceId: "SRC-LAW-001",
    title: "長照服務對象",
    category: "ELIGIBILITY" as const,
    jurisdiction: "TAIWAN" as const,
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059",
    publishedAt: "2026-06-19",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    fetchedAt: "2026-09-23T10:00:00+08:00",
    lastVerifiedAt: "2026-09-23T10:00:00+08:00",
    contentHash: "sha256:" + "a".repeat(64),
    contentFingerprint: computeContentFingerprint(dbFingerprintable),
    status: "APPROVED" as const,
    version: null,
    rawText: "條文摘錄",
    summary: overrides.dbSummary ?? overrides.summary ?? "長照服務對象摘要",
    ruleData: { minAge: 65 },
    createdAt: "2026-09-23T10:00:00+08:00",
    updatedAt: "2026-09-23T10:00:00+08:00",
    packId: "KP-2026-09-23-001",
    packRecordId: "KR-2026-001",
  };
  return { pack, dbRecord };
}

describe("runBackfillContentPacks", () => {
  it("registers a pack whose content matches the database exactly", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { pack, dbRecord } = makePackAndDbRecord();
    repo.records.push(dbRecord);

    const outcome = await runBackfillContentPacks(repo, [pack]);

    expect(outcome.registered).toEqual(["KP-2026-09-23-001"]);
    expect(outcome.skipped).toEqual([]);
    const registered = await repo.findContentPackById("KP-2026-09-23-001");
    expect(registered?.status).toBe("APPROVED");
    expect(registered?.intendedKnowledgeVersion).toBe("KB-2026-09-23-001");
  });

  it("skips (does not register) a pack whose file content no longer matches the database", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { pack, dbRecord } = makePackAndDbRecord({ summary: "檔案裡的舊摘要", dbSummary: "資料庫已經被更正過的摘要" });
    repo.records.push(dbRecord);

    const outcome = await runBackfillContentPacks(repo, [pack]);

    expect(outcome.registered).toEqual([]);
    expect(outcome.skipped).toHaveLength(1);
    expect(outcome.skipped[0].packId).toBe("KP-2026-09-23-001");
    expect(outcome.skipped[0].reasons.join(" ")).toMatch(/不符/);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toBeNull();
  });

  it("skips a pack whose record was never imported into the database", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { pack } = makePackAndDbRecord();
    // database has no matching record at all

    const outcome = await runBackfillContentPacks(repo, [pack]);

    expect(outcome.registered).toEqual([]);
    expect(outcome.skipped[0].reasons.join(" ")).toMatch(/找不到對應紀錄/);
  });
});
