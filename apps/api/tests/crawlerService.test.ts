import { createHash } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeBytesHash,
  computeContentHash,
  crawlAllActiveSources,
  createHttpFetcher,
  crawlSource,
  looksLikePdf,
  normalizeFetchedContent,
  type Fetcher,
} from "../src/services/crawlerService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { KnowledgeRecord } from "../src/types/index.js";
import type { RegistrySource } from "../src/services/knowledgeImportService.js";

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
    contentHash: computeContentHash("原始內容"),
    status: "PUBLISHED",
    version: "KB-2026-09-23-001",
    rawText: "原始內容",
    summary: "summary",
    ruleData: {},
    createdAt: "2026-09-23T10:00:00+08:00",
    updatedAt: "2026-09-23T10:00:00+08:00",
    packId: "KP-2026-09-23-001",
    packRecordId: "KR-2026-001",
    ...overrides,
  };
}

const okFetcher = (text: string): Fetcher => async () => ({ ok: true, text, errorMessage: null });
const failFetcher = (errorMessage: string): Fetcher => async () => ({ ok: false, text: null, errorMessage });

describe("normalizeFetchedContent", () => {
  it("strips script/style tags, HTML tags and collapses whitespace", () => {
    const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
      <body>  <p>長照服務對象：65 歲以上老人</p>\n\n<!-- comment --> </body></html>`;
    expect(normalizeFetchedContent(html)).toBe("長照服務對象：65 歲以上老人");
  });

  it("is a pure function: same input always normalizes to the same output", () => {
    const html = "<div>A</div><div>B</div>";
    expect(normalizeFetchedContent(html)).toBe(normalizeFetchedContent(html));
  });
});

describe("computeContentHash", () => {
  it("is deterministic and content-sensitive", () => {
    expect(computeContentHash("A")).toBe(computeContentHash("A"));
    expect(computeContentHash("A")).not.toBe(computeContentHash("B"));
    expect(computeContentHash("A")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("crawlSource", () => {
  it("no baseline record for the source: records a CrawlerRun but creates no KnowledgeChange", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const result = await crawlSource(repo, "SRC-NEW", "https://example.gov.tw/x", okFetcher("<p>新來源內容</p>"));

    expect(result.run.status).toBe("SUCCESS");
    expect(result.run.sourceId).toBe("SRC-NEW");
    expect(result.changeCreated).toBe(false);
    expect(repo.changes).toHaveLength(0);
    expect(repo.crawlerRuns).toHaveLength(1);
  });

  it("fetched content matches the baseline hash: no KnowledgeChange created", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ rawText: "長照服務對象：65 歲以上老人", contentHash: computeContentHash("長照服務對象：65 歲以上老人") }));

    const result = await crawlSource(
      repo,
      "SRC-LAW-001",
      "https://law.moj.gov.tw/x",
      okFetcher("<p>長照服務對象：65 歲以上老人</p>")
    );

    expect(result.changeCreated).toBe(false);
    expect(repo.changes).toHaveLength(0);
    expect(result.run.status).toBe("SUCCESS");
    expect(result.run.changesDetected).toBe(0);
  });

  it("fetched content differs from the baseline hash: creates a NEEDS_REVIEW KnowledgeChange linked to the baseline record", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-BASE", rawText: "舊內容", contentHash: computeContentHash("舊內容") }));

    const result = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", okFetcher("<p>新內容</p>"));

    expect(result.changeCreated).toBe(true);
    expect(repo.changes).toHaveLength(1);
    expect(repo.changes[0]).toMatchObject({
      knowledgeRecordId: "KREC-BASE",
      oldContentHash: computeContentHash("舊內容"),
      newContentHash: computeContentHash("新內容"),
      oldContent: "舊內容",
      newContent: "新內容",
      status: "NEEDS_REVIEW",
      aiSummary: null,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(result.run.changesDetected).toBe(1);
  });

  it("fetch failure -> CrawlerRun FAILED, no KnowledgeChange, existing records untouched (PRODUCT_SPEC §49)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-BASE" }));
    const before = JSON.stringify(repo.records);

    const result = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", failFetcher("HTTP 503"));

    expect(result.run.status).toBe("FAILED");
    expect(result.run.errorMessage).toBe("HTTP 503");
    expect(result.changeCreated).toBe(false);
    expect(repo.changes).toHaveLength(0);
    expect(JSON.stringify(repo.records)).toBe(before); // 既有 Knowledge 完全未被動到
  });

  it("timeout is reported as a FAILED run with the error message (Fetcher contract: implementation itself catches timeouts/network errors)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const result = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", failFetcher("逾時"));
    expect(result.run.status).toBe("FAILED");
    expect(result.run.errorMessage).toBe("逾時");
  });

  it("fetched content normalizes to empty (format changed, nothing extractable) -> FAILED, not treated as a real content change", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-BASE" }));

    const result = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", okFetcher("<script>x</script>"));

    expect(result.run.status).toBe("FAILED");
    expect(repo.changes).toHaveLength(0);
  });
});

describe("createHttpFetcher (the real Fetcher implementation catches its own errors)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a non-ok HTTP response is reported as a failure, not thrown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as unknown as Response));
    const fetcher = createHttpFetcher();
    const result = await fetcher("https://example.gov.tw/x");
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("HTTP 503");
  });

  it("a thrown network error is caught and reported as a failure, not propagated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      })
    );
    const fetcher = createHttpFetcher();
    const result = await fetcher("https://example.gov.tw/x");
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("ECONNRESET");
  });

  it("an aborted (timed out) request is reported with a 逾時 message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("This operation was aborted")));
        });
      })
    );
    const fetcher = createHttpFetcher(10); // 10ms 逾時
    const result = await fetcher("https://example.gov.tw/x");
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("逾時");
  });

  it("a successful response returns the raw text and the raw bytes", async () => {
    const bytes = new TextEncoder().encode("<p>hi</p>");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes.buffer }) as unknown as Response));
    const fetcher = createHttpFetcher();
    const result = await fetcher("https://example.gov.tw/x");
    expect(result.ok).toBe(true);
    expect(result.text).toBe("<p>hi</p>");
    expect(result.rawBytes).toEqual(bytes);
  });

  it("a PDF response (magic bytes %PDF-) is not decoded as text, only hashed by raw bytes", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0xff, 0x00]);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => pdf.buffer }) as unknown as Response));
    const fetcher = createHttpFetcher();
    const result = await fetcher("https://law.moj.gov.tw/LawGetFile.ashx?FileId=x");
    expect(result.ok).toBe(true);
    expect(result.text).toBeNull();
    expect(result.rawBytes).toEqual(pdf);
  });
});

describe("crawlAllActiveSources", () => {
  function registry(entries: Record<string, RegistrySource>): Map<string, RegistrySource> {
    return new Map(Object.entries(entries));
  }

  it("only crawls active, non-KAREO_DRIVE sources", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const fetched: string[] = [];
    const trackingFetcher: Fetcher = async (url) => {
      fetched.push(url);
      return { ok: true, text: "<p>內容</p>", errorMessage: null };
    };

    const reg = registry({
      "SRC-ACTIVE": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/a", active: true },
      "SRC-INACTIVE": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/b", active: false },
      "SRC-DRIVE": { authority: "KAREO_DRIVE", jurisdiction: "TAIWAN", url: "https://drive.google.com/file/d/x/view", active: true },
    });

    const { runs, overallStatus } = await crawlAllActiveSources(repo, reg, trackingFetcher);

    expect(fetched).toEqual(["https://law.moj.gov.tw/a"]);
    expect(runs).toHaveLength(1);
    expect(runs[0].sourceId).toBe("SRC-ACTIVE");
    expect(overallStatus).toBe("SUCCESS");
  });

  it("one source failing does not stop the others; overallStatus is PARTIAL", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const mixedFetcher: Fetcher = async (url) =>
      url.includes("bad") ? { ok: false, text: null, errorMessage: "HTTP 500" } : { ok: true, text: "<p>內容</p>", errorMessage: null };

    const reg = registry({
      "SRC-GOOD": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/good", active: true },
      "SRC-BAD": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/bad", active: true },
    });

    const { runs, overallStatus } = await crawlAllActiveSources(repo, reg, mixedFetcher);

    expect(runs).toHaveLength(2);
    expect(overallStatus).toBe("PARTIAL");
    expect(runs.find((r) => r.sourceId === "SRC-GOOD")?.status).toBe("SUCCESS");
    expect(runs.find((r) => r.sourceId === "SRC-BAD")?.status).toBe("FAILED");
  });

  it("all sources failing -> overallStatus FAILED", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const reg = registry({
      "SRC-A": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/a", active: true },
    });
    const { overallStatus } = await crawlAllActiveSources(repo, reg, failFetcher("HTTP 500"));
    expect(overallStatus).toBe("FAILED");
  });

  it("no active sources -> overallStatus SUCCESS with zero runs", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const reg = registry({
      "SRC-A": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/a", active: false },
    });
    const { runs, overallStatus } = await crawlAllActiveSources(repo, reg, okFetcher("x"));
    expect(runs).toHaveLength(0);
    expect(overallStatus).toBe("SUCCESS");
  });

  // B-009-r2（Jerry PR #37 第 5 項）：單一來源的 Repository 呼叫本身失敗（例如資料庫暫時無法連線），
  // 不得中止其餘來源的抓取；仍會補記一筆 FAILED CrawlerRun。
  it("a Repository call throwing for one source does not stop the others; a FAILED run is still recorded", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.failNextCrawlerRepoCall = true; // 只影響下一次呼叫（第一個來源）
    const reg = registry({
      "SRC-BROKEN": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/broken", active: true },
      "SRC-GOOD": { authority: "LAW", jurisdiction: "TAIWAN", url: "https://law.moj.gov.tw/good", active: true },
    });

    const { runs, overallStatus } = await crawlAllActiveSources(repo, reg, okFetcher("<p>內容</p>"));

    expect(runs).toHaveLength(2);
    expect(runs.find((r) => r.sourceId === "SRC-BROKEN")?.status).toBe("FAILED");
    expect(runs.find((r) => r.sourceId === "SRC-GOOD")?.status).toBe("SUCCESS");
    expect(overallStatus).toBe("PARTIAL");
  });
});

// B-009-r2：官方 hand-back repro（tests/integration/repro/b009-hash-dedupe.repro.ts）鎖定的兩個
// 具體臭蟲，這裡直接以 crawlSource／crawlAllActiveSources 的等價情境覆蓋，避免回歸。
describe("B-009-r2: raw-byte hashing for PDF sources and NEEDS_REVIEW de-duplication", () => {
  function pdfBytes(): Uint8Array {
    return Buffer.concat([
      Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"),
      Buffer.from([0xe2, 0x28, 0xa1, 0xff, 0x00, 0x9c]),
      Buffer.from("\n%%EOF"),
    ]);
  }

  it("looksLikePdf / computeBytesHash: PDF magic bytes detected, hash matches sha256 of raw bytes", () => {
    const pdf = pdfBytes();
    expect(looksLikePdf(pdf)).toBe(true);
    expect(looksLikePdf(Buffer.from("<html></html>"))).toBe(false);
    expect(computeBytesHash(pdf)).toBe(`sha256:${createHash("sha256").update(pdf).digest("hex")}`);
  });

  it("an unchanged PDF (baseline hash = SHA-256 of its raw bytes) does not create a KnowledgeChange", async () => {
    const pdf = pdfBytes();
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-PDF", contentHash: computeBytesHash(pdf) }));

    const pdfFetcher: Fetcher = async () => ({ ok: true, rawBytes: pdf, text: null, errorMessage: null });
    const result = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/LawGetFile.ashx?FileId=x", pdfFetcher);

    expect(result.changeCreated).toBe(false);
    expect(repo.changes).toHaveLength(0);
    expect(result.run.status).toBe("SUCCESS");
    expect(result.run.contentHash).toBe(computeBytesHash(pdf));
  });

  it("a changed PDF (different raw bytes) creates a NEEDS_REVIEW KnowledgeChange", async () => {
    const oldPdf = pdfBytes();
    const newPdf = Buffer.concat([oldPdf, Buffer.from("\nextra")]);
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-PDF", contentHash: computeBytesHash(oldPdf) }));

    const pdfFetcher: Fetcher = async () => ({ ok: true, rawBytes: newPdf, text: null, errorMessage: null });
    const result = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/LawGetFile.ashx?FileId=x", pdfFetcher);

    expect(result.changeCreated).toBe(true);
    expect(repo.changes).toHaveLength(1);
    expect(repo.changes[0].newContentHash).toBe(computeBytesHash(newPdf));
  });

  it("the same upstream change seen on two separate crawls yields only one open NEEDS_REVIEW change", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-BASE", rawText: "舊條文", contentHash: computeContentHash("舊條文") }));
    const fetcher: Fetcher = async () => ({ ok: true, text: "<p>新條文</p>", errorMessage: null });

    const day1 = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", fetcher);
    const day2 = await crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", fetcher); // 隔天重跑，上游沒有新變更

    expect(day1.changeCreated).toBe(true);
    expect(day2.changeCreated).toBe(false); // 同一筆變更已在 NEEDS_REVIEW，不重複建立
    const open = repo.changes.filter((c) => c.status === "NEEDS_REVIEW");
    expect(open).toHaveLength(1);
  });

  it("a concurrent/retried crawl for the still-pending change does not duplicate even without an explicit lock", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-BASE", rawText: "舊條文", contentHash: computeContentHash("舊條文") }));
    const fetcher: Fetcher = async () => ({ ok: true, text: "<p>新條文</p>", errorMessage: null });

    const [a, b] = await Promise.all([
      crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", fetcher),
      crawlSource(repo, "SRC-LAW-001", "https://law.moj.gov.tw/x", fetcher),
    ]);

    const insertedCount = [a.changeCreated, b.changeCreated].filter(Boolean).length;
    expect(insertedCount).toBe(1);
    expect(repo.changes.filter((c) => c.status === "NEEDS_REVIEW")).toHaveLength(1);
  });

  it("CrawlerRun.contentHash is recorded even when nothing changed (auditable snapshot every run, not only on change)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ rawText: "長照服務對象：65 歲以上老人", contentHash: computeContentHash("長照服務對象：65 歲以上老人") }));

    const result = await crawlSource(
      repo,
      "SRC-LAW-001",
      "https://law.moj.gov.tw/x",
      okFetcher("<p>長照服務對象：65 歲以上老人</p>")
    );

    expect(result.run.status).toBe("SUCCESS");
    expect(result.run.contentHash).toBe(computeContentHash("長照服務對象：65 歲以上老人"));
  });
});
