import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeContentHash,
  crawlAllActiveSources,
  createHttpFetcher,
  crawlSource,
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
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, text: async () => "" }) as unknown as Response));
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

  it("a successful response returns the raw text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "<p>hi</p>" }) as unknown as Response));
    const fetcher = createHttpFetcher();
    const result = await fetcher("https://example.gov.tw/x");
    expect(result).toEqual({ ok: true, text: "<p>hi</p>", errorMessage: null });
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
});
