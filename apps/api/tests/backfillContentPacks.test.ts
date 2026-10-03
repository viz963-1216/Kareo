// TASK-B-012-r3（Jerry 指示 2）：「提供回填指令：讀 contracts/knowledge/packs/*.json，逐筆比對
// 資料庫內容指紋，一致才登錄。」模擬 B-012 上線前就已經匯入、資料庫裡已有紀錄但 content_packs
// 還沒有任何登錄的情境（不透過 importContentPack，直接灌資料庫，比照真實的「舊資料」）。
import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { runBackfillContentPacks } from "../src/scripts/backfillContentPacks.js";
import { computeContentFingerprint } from "../src/services/contentFingerprint.js";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
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

  // Jerry 2026-10-03 第 1 點：回填與匯入共用同一份內容包驗證。
  it("skips (does not register) an APPROVED pack whose top-level review is missing", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { pack, dbRecord } = makePackAndDbRecord();
    repo.records.push(dbRecord);
    delete (pack as Record<string, unknown>).review;

    const outcome = await runBackfillContentPacks(repo, [pack]);

    expect(outcome.registered).toEqual([]);
    expect(outcome.skipped[0].reasons.join(" ")).toMatch(/內容包層級 review/);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toBeNull();
    expect(repo.reviewEvents).toHaveLength(0);
  });

  // Jerry 2026-10-03 第 2 點：回填逐筆審核證據（DATA_MODEL §26c）。
  it("backfills one CLI_PACK review event per approved record, using the reviewer and time from the pack, and is idempotent", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { pack, dbRecord } = makePackAndDbRecord();
    repo.records.push({ ...dbRecord, status: "PUBLISHED", version: "KB-2026-09-24-001" });

    const first = await runBackfillContentPacks(repo, [pack]);
    const second = await runBackfillContentPacks(repo, [pack]);

    expect(first).toMatchObject({ reviewEventsInserted: 1, reviewEventsAlreadyPresent: 0 });
    expect(second).toMatchObject({ reviewEventsInserted: 0, reviewEventsAlreadyPresent: 1 });
    expect(repo.reviewEvents).toHaveLength(1);
    expect(repo.reviewEvents[0]).toMatchObject({
      knowledgeRecordId: "KREC-001",
      decision: "APPROVED",
      reviewedBy: "Jerry",
      reviewedAt: "2026-09-23T09:00:00+08:00",
      contentFingerprint: dbRecord.contentFingerprint,
      source: "CLI_PACK",
    });
    expect(repo.records[0]).toMatchObject({ status: "PUBLISHED", summary: dbRecord.summary }); // unchanged
  });

  it("does not create review evidence for a record the database never approved", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { pack, dbRecord } = makePackAndDbRecord();
    repo.records.push({ ...dbRecord, status: "NEEDS_REVIEW" });

    const outcome = await runBackfillContentPacks(repo, [pack]);

    expect(outcome.registered).toEqual(["KP-2026-09-23-001"]);
    expect(outcome.reviewEventsInserted).toBe(0);
    expect(repo.reviewEvents).toHaveLength(0);
  });

  // 雲端已發布的 21 筆（KB-2026-09-24-001）情境：以實際 5 個內容包檔案模擬「B-012 上線前已匯入並發布」。
  it("real packs: registers all 5 packs and backfills 21 review events for PUBLISHED records without changing them", async () => {
    const registry = parseSourceRegistry(readFileSync("../../docs/knowledge/source-registry.md", "utf-8"));
    const dir = "../../contracts/knowledge/packs";
    const packs = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf-8")) as RawContentPack);
    const repo = new InMemoryKnowledgeRepository();
    for (const p of packs) await importContentPack(repo, p, registry, { mode: "commit", importedBy: "TEST" });
    for (const r of repo.records) {
      r.status = "PUBLISHED";
      r.version = "KB-2026-09-24-001";
    }
    repo.contentPacks.length = 0; // pre-B-012 database: no registration, no review events
    const before = repo.records.map((r) => ({ ...r }));

    const outcome = await runBackfillContentPacks(repo, packs);

    expect(outcome.skipped).toEqual([]);
    expect(outcome.registered).toHaveLength(5);
    expect(repo.records).toHaveLength(21);
    expect(outcome.reviewEventsInserted).toBe(21);
    expect(repo.reviewEvents.every((e) => e.source === "CLI_PACK" && e.decision === "APPROVED")).toBe(true);
    expect(repo.records).toEqual(before);
    for (const p of packs) {
      expect((await repo.findContentPackById(p.packId as string))?.status).toBe("APPROVED");
    }
  });

  it("a pack containing a REJECTED record gets the same fingerprints from import and backfill", async () => {
    const registry = parseSourceRegistry(readFileSync("../../docs/knowledge/source-registry.md", "utf-8"));
    const pack = (): RawContentPack => JSON.parse(readFileSync("../../contracts/knowledge/packs/KP-2026-09-24-003.json", "utf-8"));
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack(), registry, { mode: "commit", importedBy: "TEST" });
    const fromImport = await repo.findContentPackById("KP-2026-09-24-003");

    const outcome = await runBackfillContentPacks(repo, [pack()]);
    const fromBackfill = await repo.findContentPackById("KP-2026-09-24-003");

    expect(outcome.skipped).toEqual([]);
    expect(fromBackfill?.recordsFingerprint).toBe(fromImport?.recordsFingerprint);
    expect(fromBackfill?.packFingerprint).toBe(fromImport?.packFingerprint);
  });
});

// Jerry 2026-10-03 第 4 點：被 import 時不得自動執行 CLI、不得嘗試建立 Supabase client。
describe("backfillContentPacks module entry", () => {
  it("importing the module does not run the CLI", async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCodeBefore = process.exitCode;

    await import("../src/scripts/backfillContentPacks.js");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(exitCodeBefore);
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
