// J-003 repro for B-009 (hand-back, not a J-003 fix). Copy to apps/api/tests/ as <name>.test.ts and run:
//   cd apps/api && npx vitest run tests/b009-hash-dedupe.test.ts
// Expected today: both tests FAIL (they state the required behaviour).
//
// 1. PDF sources: Source Registry / content packs record the SHA-256 of the downloaded PDF bytes
//    (docs/knowledge/source-registry.md "PDF sha256"). createHttpFetcher decodes the body with res.text()
//    (lossy for binary) and crawlSource hashes normalizeFetchedContent(text), which also strips "<<...>>"
//    PDF dictionaries as if they were HTML tags. An unchanged PDF therefore never matches its baseline and
//    produces a NEEDS_REVIEW change every day (TASK-B-009: 未變更時不產生 KnowledgeChange；以 PDF 為準).
// 2. Same change twice: the comparison baseline is the latest KnowledgeRecord only, so the same upstream
//    change detected on consecutive days creates a new NEEDS_REVIEW KnowledgeChange each day.
import { createHash } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import { computeContentHash, createHttpFetcher, crawlSource, type Fetcher } from "../src/services/crawlerService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { KnowledgeRecord } from "../src/types/index.js";

function baseline(contentHash: string, rawText = "baseline"): KnowledgeRecord {
  return {
    id: "KREC-J003", sourceId: "SRC-LAW-L0020178-T", title: "synthetic", category: "BENEFIT", jurisdiction: "TAIWAN",
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000293764&lan=C", publishedAt: null,
    effectiveFrom: "2022-01-01", effectiveTo: null, fetchedAt: "2026-09-24T10:00:00+08:00", lastVerifiedAt: "2026-09-24T10:00:00+08:00",
    contentHash, status: "PUBLISHED", version: "KB-2026-09-24-001", rawText, summary: "s", ruleData: {},
    createdAt: "2026-09-24T10:00:00+08:00", updatedAt: "2026-09-24T10:00:00+08:00", packId: "KP-J003", packRecordId: "KR-J003",
  } as KnowledgeRecord;
}

afterEach(() => vi.unstubAllGlobals());

describe("B-009 crawler hashing and de-duplication", () => {
  it("an unchanged PDF (hash = SHA-256 of its bytes) does not create a KnowledgeChange", async () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"), Buffer.from([0xe2, 0x28, 0xa1, 0xff, 0x00, 0x9c]), Buffer.from("\n%%EOF")]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(pdf, { status: 200, headers: { "content-type": "application/pdf" } })));
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(baseline(`sha256:${createHash("sha256").update(pdf).digest("hex")}`));

    const { changeCreated } = await crawlSource(repo, "SRC-LAW-L0020178-T", "https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000293764&lan=C", createHttpFetcher(5000));
    expect(changeCreated).toBe(false);
  });

  it("the same upstream change seen on two days yields one open NEEDS_REVIEW change", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(baseline(computeContentHash("舊條文"), "舊條文"));
    const fetcher: Fetcher = async () => ({ ok: true, text: "<p>新條文</p>", errorMessage: null });

    await crawlSource(repo, "SRC-LAW-L0020178-T", "https://law.moj.gov.tw/x", fetcher); // day 1
    await crawlSource(repo, "SRC-LAW-L0020178-T", "https://law.moj.gov.tw/x", fetcher); // day 2, nothing new upstream
    const open = repo.changes.filter((c) => c.status === "NEEDS_REVIEW");
    expect(open).toHaveLength(1);
  });
});
