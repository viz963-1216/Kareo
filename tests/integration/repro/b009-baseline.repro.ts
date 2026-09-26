// J-003 repro for B-009-r2 (PR #37, commit 467cb14). Copy to apps/api/tests/ as b009-baseline.test.ts:
//   cd apps/api && npx vitest run tests/b009-baseline.test.ts
// Expected on 467cb14: FAIL (states the required behaviour).
//
// For HTML sources the crawler hashes normalizeFetchedContent(text) and compares it with the
// KnowledgeRecord contentHash. Content packs record that hash as the SHA-256 of the downloaded HTML
// (docs/knowledge/source-registry.md "HTML sha256"), i.e. a different representation. An unchanged page
// therefore produces a NEEDS_REVIEW change on the first run (de-duplication then hides the repeats).
// Comparisons must use one representation (raw vs raw, or normalized vs normalized from a stored snapshot).
import { createHash } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createHttpFetcher, crawlSource } from "../src/services/crawlerService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { KnowledgeRecord } from "../src/types/index.js";

afterEach(() => vi.unstubAllGlobals());

describe("B-009 HTML comparison uses the same representation as the baseline", () => {
  it("an unchanged HTML page (baseline = SHA-256 of the HTML) does not create a KnowledgeChange", async () => {
    const html = "<html><head><script>var t=1</script></head><body><h1>申請長照服務</h1><p>撥打 1966</p></body></html>";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })));
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push({
      id: "KREC-J003-HTML", sourceId: "SRC-MOHW-1966-APPLY", title: "synthetic", category: "APPLICATION", jurisdiction: "TAIWAN",
      sourceUrl: "https://1966.gov.tw/LTC/cp-6533-70777-207.html", publishedAt: null, effectiveFrom: "2026-01-01", effectiveTo: null,
      fetchedAt: "2026-09-24T10:00:00+08:00", lastVerifiedAt: "2026-09-24T10:00:00+08:00",
      contentHash: `sha256:${createHash("sha256").update(Buffer.from(html, "utf8")).digest("hex")}`,
      status: "PUBLISHED", version: "KB-2026-09-24-001", rawText: "申請長照服務 撥打 1966", summary: "s", ruleData: {},
      createdAt: "2026-09-24T10:00:00+08:00", updatedAt: "2026-09-24T10:00:00+08:00", packId: "KP-J003", packRecordId: "KR-J003",
    } as KnowledgeRecord);
    const { changeCreated } = await crawlSource(repo, "SRC-MOHW-1966-APPLY", "https://1966.gov.tw/LTC/cp-6533-70777-207.html", createHttpFetcher(5000));
    expect(changeCreated).toBe(false);
  });
});
