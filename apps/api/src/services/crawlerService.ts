import { createHash } from "node:crypto";
import type { KnowledgeRepository } from "../repositories/types.js";
import type { CrawlerRun, CrawlerRunStatus } from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import type { RegistrySource } from "./knowledgeImportService.js";

// 依 PRODUCT_SPEC §42：Official Source → Crawler → Snapshot → Content Hash → Compare →
// Detect Change → KnowledgeChange（NEEDS_REVIEW）→ Review → Publish。Crawler 永遠不自動核准或
// 發布（§43）；抓取失敗不得清空或刪除既有 Knowledge，繼續使用 Last Published（§49，DATA_MODEL §28）。

export function computeContentHash(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

// 比對以條文正文為準，不以整頁 HTML 雜湊判斷（tasks/TASK-B-009.md 前置條件）。
// 已知限制（實測發現，非推測）：
// 1. 這只是最基本的 HTML 正規化（移除 script/style/標籤、壓縮空白），不是完整的正文抽取，
//    無法排除導覽列、頁尾等版型雜訊，可能因版型微調誤判為內容變更；這是刻意的保守設計——
//    誤報只會多產生 NEEDS_REVIEW（人工審核判斷是否為實質變更），不會自動上線（§43），
//    比「漏報真正的內容變更」安全。逐來源客製的正文抽取規則留待後續依實際擷取狀況調整。
// 2. **PDF 來源**（Source Registry 裡多筆 LawGetFile.ashx PDF 連結）：fetch 回傳的是 PDF 二進位
//    內容，本函式對 PDF 沒有做文字抽取（沒有引入 PDF 解析套件，避免未經同意就新增依賴）。
//    內容 hash 仍然正確（PDF 位元組不同就會偵測到變更，符合「以 PDF 為準」的比對基礎），
//    但 KnowledgeChange.oldContent／newContent 對 PDF 來源會是不可讀的原始位元組，人工審核
//    需要另外開啟 sourceUrl 看實際 PDF 內容，不能只看 KnowledgeChange 裡的文字差異。
//    若要讓 PDF 也能顯示可讀正文差異，需要新增 PDF 解析套件，屬於範圍外的技術選型決定，
//    留給 Jerry／J-002 決定是否需要。
export function normalizeFetchedContent(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FetchResult {
  ok: boolean;
  text: string | null;
  errorMessage: string | null;
}

export type Fetcher = (url: string) => Promise<FetchResult>;

// 正式環境用：Node 22 原生 fetch，附逾時（預設 20 秒，PRODUCT_SPEC 未規定確切秒數，
// 參考 B-010 知識查詢逾時 5 秒與外部網站普遍回應時間，取較寬鬆值，避免正常慢速政府網站被誤判逾時）。
export function createHttpFetcher(timeoutMs = 20000): Fetcher {
  return async (url: string): Promise<FetchResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) {
        return { ok: false, text: null, errorMessage: `HTTP ${res.status}` };
      }
      const text = await res.text();
      return { ok: true, text, errorMessage: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, text: null, errorMessage: message.includes("abort") ? "逾時" : message };
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface CrawlSourceResult {
  run: CrawlerRun;
  changeCreated: boolean;
}

// 單一來源的抓取／比對／CrawlerRun 寫入。沒有既有 KnowledgeRecord 可比對時（來源第一次被登錄、
// 尚未有人工匯入過任何內容）只記錄 CrawlerRun，不建立 KnowledgeChange——knowledge_changes.
// knowledge_record_id 為 NOT NULL（migration 0006），沒有紀錄可掛；首次內容一律由人工經 B-008
// 內容包匯入，不由 Crawler 自動建立第一筆。
export async function crawlSource(
  repo: KnowledgeRepository,
  sourceId: string,
  url: string,
  fetcher: Fetcher
): Promise<CrawlSourceResult> {
  const startedAt = nowTaipeiISOString();
  const runId = generateId("CRUN");

  const fetched = await fetcher(url);
  const normalized = fetched.ok && fetched.text !== null ? normalizeFetchedContent(fetched.text) : null;

  // 抓取成功但正規化後沒有任何內容 → 視為格式改變（無法擷取正文），不得誤判為「內容變成空白」。
  if (!fetched.ok || normalized === null || normalized.length === 0) {
    const run: CrawlerRun = {
      id: runId,
      sourceId,
      startedAt,
      finishedAt: nowTaipeiISOString(),
      status: "FAILED",
      itemsChecked: 0,
      changesDetected: 0,
      errorMessage: fetched.errorMessage ?? (normalized === "" ? "頁面格式改變，擷取不到正文內容" : "抓取失敗"),
    };
    await repo.insertCrawlerRun(run);
    return { run, changeCreated: false };
  }

  const newHash = computeContentHash(normalized);
  const baseline = await repo.findLatestRecordBySourceId(sourceId);

  let changesDetected = 0;
  let changeCreated = false;
  if (baseline && baseline.contentHash !== newHash) {
    await repo.insertKnowledgeChange({
      id: generateId("KCHG"),
      knowledgeRecordId: baseline.id,
      oldContentHash: baseline.contentHash,
      newContentHash: newHash,
      oldContent: baseline.rawText,
      newContent: normalized,
      aiSummary: null,
      status: "NEEDS_REVIEW",
      detectedAt: nowTaipeiISOString(),
      reviewedAt: null,
      reviewedBy: null,
    });
    changesDetected = 1;
    changeCreated = true;
  }

  const run: CrawlerRun = {
    id: runId,
    sourceId,
    startedAt,
    finishedAt: nowTaipeiISOString(),
    status: "SUCCESS",
    itemsChecked: 1,
    changesDetected,
    errorMessage: null,
  };
  await repo.insertCrawlerRun(run);
  return { run, changeCreated };
}

export interface CrawlAllResult {
  runs: CrawlerRun[];
  overallStatus: CrawlerRunStatus;
}

// 對 Source Registry 全部 active、非 KAREO_DRIVE 的來源各執行一次（D-15：KAREO_DRIVE 不列入每日
// 抓取，只抓官方網站）；任一來源失敗不影響其他來源繼續執行，也不清空或刪除任何既有 Knowledge。
export async function crawlAllActiveSources(
  repo: KnowledgeRepository,
  registry: Map<string, RegistrySource>,
  fetcher: Fetcher
): Promise<CrawlAllResult> {
  const runs: CrawlerRun[] = [];
  for (const [sourceId, entry] of registry) {
    if (!entry.active || entry.authority === "KAREO_DRIVE") continue;
    const { run } = await crawlSource(repo, sourceId, entry.url, fetcher);
    runs.push(run);
  }

  const failedCount = runs.filter((r) => r.status === "FAILED").length;
  const overallStatus: CrawlerRunStatus =
    runs.length === 0 || failedCount === 0 ? "SUCCESS" : failedCount === runs.length ? "FAILED" : "PARTIAL";
  return { runs, overallStatus };
}
