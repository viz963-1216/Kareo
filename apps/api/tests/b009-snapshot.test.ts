// Jerry 委託修正第二輪（2026-09-27）：原始快照保存與一致的比較基準。涵蓋失敗案例 A（PDF 快照
// 可完整讀回）、C（尚無 KnowledgeRecord 時仍保存快照，可偵測後續變更）、E（未變更抓取仍有可追溯
// 快照關聯）、F（快照寫入失敗明確 FAILED）、G（不自動核准或發布、不清除既有 Published）。
// B（HTML 比對使用一致表示法）、D（同一變更重跑／併發去重）已分別由
// tests/b009-baseline.test.ts、tests/b009-hash-dedupe.test.ts 覆蓋。
import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { crawlSource, crawlAllActiveSources, computeBytesHash, type Fetcher } from "../src/services/crawlerService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import { computeContentFingerprint } from "../src/services/contentFingerprint.js";
import type { KnowledgeRecord } from "../src/types/index.js";
import type { RegistrySource } from "../src/services/knowledgeImportService.js";

function pdfBytes(marker: number): Buffer {
  return Buffer.concat([Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"), Buffer.from([marker]), Buffer.from("\n%%EOF")]);
}

describe("B-009 raw snapshot storage and readback (case A: PDF)", () => {
  it("a crawled PDF's exact bytes can be read back later, even after the source later changes", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const firstPdf = pdfBytes(0x01);
    const fetcherA: Fetcher = async () => ({ ok: true, rawBytes: firstPdf, text: null, contentType: "application/pdf", errorMessage: null });
    const { run: runA } = await crawlSource(repo, "SRC-LAW-L0020178-T", "https://law.moj.gov.tw/x", fetcherA);

    // 原站後來變成別的 PDF（模擬「內容改變」）。
    const secondPdf = pdfBytes(0x02);
    const fetcherB: Fetcher = async () => ({ ok: true, rawBytes: secondPdf, text: null, contentType: "application/pdf", errorMessage: null });
    await crawlSource(repo, "SRC-LAW-L0020178-T", "https://law.moj.gov.tw/x", fetcherB);

    // 第一次抓取當時的快照仍然完整可讀回，位元組與雜湊跟當初完全一致（不受之後的抓取影響）。
    const firstSnapshot = repo.snapshots.find((s) => s.crawlerRunId === runA.id);
    expect(firstSnapshot).toBeDefined();
    expect(Buffer.from(firstSnapshot!.rawBytes)).toEqual(firstPdf);
    expect(firstSnapshot!.rawHash).toBe(computeBytesHash(firstPdf));
    expect(firstSnapshot!.rawHash).toBe(`sha256:${createHash("sha256").update(firstPdf).digest("hex")}`);
    expect(firstSnapshot!.extractionMethodVersion).toBe("none"); // PDF：明確標記未抽取文字，不假裝有做抽取。
  });
});

describe("B-009 snapshot without a KnowledgeRecord (case C)", () => {
  it("a source with no KnowledgeRecord yet still gets its snapshot saved and readable, and a later change is visible at the snapshot level", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const fetcher1: Fetcher = async () => ({ ok: true, text: "<p>第一次抓到的內容</p>", errorMessage: null });
    const result1 = await crawlSource(repo, "SRC-NEW", "https://example.gov.tw/new", fetcher1);
    expect(result1.changeCreated).toBe(false); // 沒有 KnowledgeRecord 可比對，不建立 KnowledgeChange（既有規則不變）。
    expect(repo.changes).toHaveLength(0);

    const snapshot1 = await repo.findLatestSnapshotBySourceId("SRC-NEW");
    expect(snapshot1).not.toBeNull();
    expect(snapshot1!.crawlerRunId).toBe(result1.run.id); // 快照確實存了，即使沒有 KnowledgeRecord 可掛。

    const fetcher2: Fetcher = async () => ({ ok: true, text: "<p>第二次抓到的不同內容</p>", errorMessage: null });
    const result2 = await crawlSource(repo, "SRC-NEW", "https://example.gov.tw/new", fetcher2);
    expect(result2.changeCreated).toBe(false); // 依然沒有 KnowledgeRecord，依然不建立 KnowledgeChange。

    const snapshot2 = await repo.findLatestSnapshotBySourceId("SRC-NEW");
    // 快照層級可以偵測到「跟上一次抓取不一樣」：兩次快照的 rawHash 不同，且都完整保存、可個別讀回。
    expect(snapshot2!.rawHash).not.toBe(snapshot1!.rawHash);
    expect(repo.snapshots.filter((s) => s.sourceId === "SRC-NEW")).toHaveLength(2);
  });
});

describe("B-009 traceable snapshot association even when unchanged (case E)", () => {
  it("an unchanged crawl still records a CrawlerRun linked to a snapshot (not only a hash)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const html = "<p>長照服務對象：65 歲以上老人</p>";
    repo.records.push({
      id: "KREC-001", sourceId: "SRC-LAW-001", title: "t", category: "ELIGIBILITY", jurisdiction: "TAIWAN",
      sourceUrl: "https://law.moj.gov.tw/x", publishedAt: null, effectiveFrom: "2026-01-01", effectiveTo: null,
      fetchedAt: "2026-09-23T10:00:00+08:00", lastVerifiedAt: "2026-09-23T10:00:00+08:00",
      contentHash: `sha256:${createHash("sha256").update("長照服務對象：65 歲以上老人").digest("hex")}`,
      status: "PUBLISHED", version: "KB-1", rawText: "長照服務對象：65 歲以上老人", summary: "s", ruleData: {},
      createdAt: "2026-09-23T10:00:00+08:00", updatedAt: "2026-09-23T10:00:00+08:00", packId: "KP-1", packRecordId: "KR-1",
    } as KnowledgeRecord);

    const fetcher: Fetcher = async () => ({ ok: true, text: html, errorMessage: null });
    const { run, changeCreated } = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", fetcher);

    expect(changeCreated).toBe(false);
    expect(run.snapshotId).not.toBeNull();
    const snapshot = repo.snapshots.find((s) => s.id === run.snapshotId);
    expect(snapshot).toBeDefined(); // 即使沒有變更，CrawlerRun 仍關聯到一筆可讀回原始內容的快照。
  });
});

describe("B-009 snapshot write failure is a real FAILED run, not a fabricated success (case F)", () => {
  it("a source failing does not stop the others, and is recorded as FAILED (not silently dropped)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    vi.spyOn(repo, "insertSnapshot").mockRejectedValueOnce(new Error("snapshot unavailable"));
    const reg = new Map<string, RegistrySource>([
      ["SRC-BROKEN", { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/broken", active: true }],
      ["SRC-GOOD", { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/good", active: true }],
    ]);
    const fetcher: Fetcher = async () => ({ ok: true, text: "<p>內容</p>", errorMessage: null });

    const { runs, overallStatus } = await crawlAllActiveSources(repo, reg, fetcher);

    expect(runs.find((r) => r.sourceId === "SRC-BROKEN")?.status).toBe("FAILED");
    expect(runs.find((r) => r.sourceId === "SRC-GOOD")?.status).toBe("SUCCESS");
    expect(overallStatus).toBe("PARTIAL");
    // 失敗的那次沒有留下任何快照（沒有持久保存的內容不能算成功）。
    expect(repo.snapshots.some((s) => s.sourceId === "SRC-BROKEN")).toBe(false);
  });
});

describe("B-009: crawler never touches Published knowledge (case G, existing invariant re-confirmed)", () => {
  it("detecting a change does not alter the PUBLISHED record or auto-approve/publish anything", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const publishedBase: Omit<KnowledgeRecord, "contentFingerprint"> = {
      id: "KREC-PUB", sourceId: "SRC-LAW-001", title: "t", category: "ELIGIBILITY", jurisdiction: "TAIWAN",
      sourceUrl: "https://law.moj.gov.tw/x", publishedAt: null, effectiveFrom: "2026-01-01", effectiveTo: null,
      fetchedAt: "2026-09-23T10:00:00+08:00", lastVerifiedAt: "2026-09-23T10:00:00+08:00",
      contentHash: computeBytesHash(Buffer.from("舊內容")), status: "PUBLISHED", version: "KB-1", rawText: "舊內容", summary: "s", ruleData: {},
      createdAt: "2026-09-23T10:00:00+08:00", updatedAt: "2026-09-23T10:00:00+08:00", packId: "KP-1", packRecordId: "KR-1",
    };
    const published: KnowledgeRecord = {
      ...publishedBase,
      contentFingerprint: computeContentFingerprint(publishedBase),
    };
    repo.records.push(published);
    const before = JSON.stringify(published);

    const fetcher: Fetcher = async () => ({ ok: true, text: "<p>新內容</p>", errorMessage: null });
    const { changeCreated } = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", fetcher);

    expect(changeCreated).toBe(true);
    expect(repo.changes[0].status).toBe("NEEDS_REVIEW"); // 只建立待審變更，不自動核准或發布。
    expect(JSON.stringify(repo.records.find((r) => r.id === "KREC-PUB"))).toBe(before); // PUBLISHED 紀錄完全未被動到。
    expect(repo.versions).toHaveLength(0); // 沒有任何知識版本被建立或改動。
  });
});
