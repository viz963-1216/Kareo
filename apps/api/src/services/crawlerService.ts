import { createHash } from "node:crypto";
import type { KnowledgeRepository } from "../repositories/types.js";
import type { CrawlerRun, CrawlerRunStatus, CrawlerSnapshot } from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import type { RegistrySource } from "./knowledgeImportService.js";

// 依 PRODUCT_SPEC §42：Official Source → Crawler → Snapshot → Content Hash → Compare →
// Detect Change → KnowledgeChange（NEEDS_REVIEW）→ Review → Publish。Crawler 永遠不自動核准或
// 發布（§43）；抓取失敗不得清空或刪除既有 Knowledge，繼續使用 Last Published（§49，DATA_MODEL §28）。
//
// Jerry 委託修正第二輪（2026-09-27）：B-009-r2 已經區分 PDF／文字兩種雜湊，但仍只用「正規化文字
// 雜湊」單一表示法跟 KnowledgeRecord.contentHash 比對。docs/knowledge/source-registry.md 對不同
// 來源記錄基準雜湊時，表示法並不一致——有些標「HTML sha256」（整頁原始位元組雜湊），有些標
// 「文字 sha256」（抽取後的正文雜湊），PDF 一律是原始位元組雜湊（見該檔案頭的說明）。只用單一
// 表示法比對，遇到用「HTML sha256」建版基準的來源，未變更的頁面第一次抓取就會被誤判為變更
// （tests/integration/repro/b009-baseline.repro.ts）。
//
// 修正：
//   1. 原始快照（位元組本身，不只是雜湊）一律持久保存（CrawlerSnapshot，見 repositories），
//      掛在 source_id（一律存在），不掛在 knowledge_record_id（可能還沒有）。
//   2. 同時計算 rawHash（原始位元組）與 normalizedHash（正文抽取，僅文字來源），比對 KnowledgeRecord
//      基準時任一種相符就視為未變更——不知道 Jerry／J-002 當初是用哪種表示法建立基準，寧可兩種都
//      試，也不要因為表示法猜錯而每天誤報變更（誤報的後果比多一次比對更嚴重：見 §43 人工審核
//      永遠是最後防線，但每天狼來了會讓審核麻痺）。真正的內容變更（兩種表示法都對不上）才會建立
//      KnowledgeChange。

export function computeContentHash(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

// 對原始位元組計算雜湊（PDF／任何二進位來源的比對基礎；文字來源沒有 rawBytes 時，
// 呼叫端會用 UTF-8 編碼文字後的位元組代入，兩者雜湊格式一致，皆為 sha256:<hex>）。
export function computeBytesHash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

// %PDF- 開頭（magic bytes）判斷是否為 PDF，不依賴伺服器回傳的 content-type（可能不準確或缺漏）。
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

// 比對以條文正文為準，不以整頁 HTML 雜湊判斷（tasks/TASK-B-009.md 前置條件）。
// 已知限制（實測發現，非推測）：這只是最基本的 HTML 正規化（移除 script/style/標籤、壓縮空白），
// 不是完整的正文抽取，無法排除導覽列、頁尾等版型雜訊，可能因版型微調誤判為內容變更；這是刻意的
// 保守設計——誤報只會多產生 NEEDS_REVIEW（人工審核判斷是否為實質變更），不會自動上線（§43），
// 比「漏報真正的內容變更」安全。逐來源客製的正文抽取規則留待後續依實際擷取狀況調整。
//
// HTML_NORMALIZE_VERSION：這個函式的規則版本字串，隨 CrawlerSnapshot 一起存。日後調整正規化規則
// 時記得同步升版，讓舊快照的 normalizedHash 不會被誤認為是用新規則算出來的。
export const HTML_NORMALIZE_VERSION = "html-strip-v1";

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
  // 原始位元組：一律保留供雜湊使用（PDF 的正確比對基礎；也是「可追溯抓取快照」的依據）。
  // 選填是為了向後相容既有以純文字構造 FetchResult 的測試／自訂 Fetcher；缺少時 crawlSource
  // 會以 UTF-8 編碼 text 代入，行為與 r1 相同。
  rawBytes?: Uint8Array | null;
  // 盡力解碼的文字。PDF 一律為 null——沒有引入 PDF 文字抽取套件，寧可明確標記「無法抽取正文」
  // 也不假裝解碼成功而產生看似正常實則亂碼的 newContent（見下方 isPdfContent 分支）。
  text: string | null;
  contentType?: string | null;
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
        return { ok: false, rawBytes: null, text: null, errorMessage: `HTTP ${res.status}` };
      }
      const contentType = res.headers.get("content-type");
      const rawBytes = new Uint8Array(await res.arrayBuffer());
      if (looksLikePdf(rawBytes)) {
        // PDF：保留原始位元組供雜湊／稽核，不嘗試解碼文字（見上方 FetchResult.text 說明）。
        return { ok: true, rawBytes, text: null, contentType, errorMessage: null };
      }
      const text = new TextDecoder("utf-8").decode(rawBytes);
      return { ok: true, rawBytes, text, contentType, errorMessage: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, rawBytes: null, text: null, errorMessage: message.includes("abort") ? "逾時" : message };
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface CrawlSourceResult {
  run: CrawlerRun;
  changeCreated: boolean;
}

function failedRun(runId: string, sourceId: string, startedAt: string, errorMessage: string): CrawlerRun {
  return {
    id: runId,
    sourceId,
    startedAt,
    finishedAt: nowTaipeiISOString(),
    status: "FAILED",
    itemsChecked: 0,
    changesDetected: 0,
    contentHash: null,
    snapshotId: null,
    errorMessage,
  };
}

// 單一來源的抓取／比對／CrawlerRun 寫入。沒有既有 KnowledgeRecord 可比對時（來源第一次被登錄、
// 尚未有人工匯入過任何內容）不建立 KnowledgeChange——knowledge_changes.knowledge_record_id 為
// NOT NULL（migration 0006），沒有紀錄可掛；首次內容一律由人工經 B-008 內容包匯入，不由 Crawler
// 自動建立第一筆。但即使沒有 KnowledgeRecord，只要抓取成功仍會保存 CrawlerSnapshot（Jerry 委託
// 修正第二輪第 4 項：不可因無外鍵對象直接失去新來源變更追蹤）。
export async function crawlSource(
  repo: KnowledgeRepository,
  sourceId: string,
  url: string,
  fetcher: Fetcher
): Promise<CrawlSourceResult> {
  const startedAt = nowTaipeiISOString();
  const runId = generateId("CRUN");

  // Snapshot.crawler_run_id 是立即檢查的外鍵；先建立 RUNNING，最後以同一 id 完成。
  await repo.insertCrawlerRun({
    id: runId, sourceId, startedAt, finishedAt: null, status: "RUNNING",
    itemsChecked: 0, changesDetected: 0, contentHash: null, snapshotId: null, errorMessage: null,
  });
  let savedSnapshotId: string | null = null;
  try {

    const fetched = await fetcher(url);

    if (!fetched.ok) {
      const run = failedRun(runId, sourceId, startedAt, fetched.errorMessage ?? "抓取失敗");
      await repo.insertCrawlerRun(run);
      return { run, changeCreated: false };
    }

    // 原始位元組：優先用 Fetcher 提供的 rawBytes（正式 createHttpFetcher 一律提供）；
    // 缺少時（例如既有測試以純文字構造 FetchResult）以 UTF-8 編碼 text 代入，維持既有文字來源行為不變。
    const rawBytes = fetched.rawBytes ?? (fetched.text !== null ? new TextEncoder().encode(fetched.text) : null);
    const isPdf = rawBytes !== null && looksLikePdf(rawBytes);

    if (rawBytes === null) {
      // 理論上不會發生（createHttpFetcher 對 ok:true 一律回傳 rawBytes 或 text 其中之一），
      // 但自訂 Fetcher 若違反契約回傳兩者皆空，明確失敗，不假裝比對成功。
      const run = failedRun(runId, sourceId, startedAt, "Fetcher 回傳內容為空（無 rawBytes 也無 text）");
      await repo.insertCrawlerRun(run);
      return { run, changeCreated: false };
    }

    const rawHash = computeBytesHash(rawBytes);
    let normalizedHash: string | null = null;
    let newContentForChange = "（PDF 來源：未抽取文字，請開啟 sourceUrl 查看原始內容）";

    if (!isPdf && fetched.text !== null) {
      const normalized = normalizeFetchedContent(fetched.text);
      // 抓取成功但正規化後沒有任何內容 → 視為格式改變（無法擷取正文），不得誤判為「內容變成空白」。
      // 這個情況連快照都不建立：拿到的原始位元組本身無法判斷是否只是版型調整，優先明確失敗、
      // 促使人工檢查，比默默存一筆看不出問題的快照更安全。
      if (normalized.length === 0) {
        const run = failedRun(runId, sourceId, startedAt, "頁面格式改變，擷取不到正文內容");
        await repo.insertCrawlerRun(run);
        return { run, changeCreated: false };
      }
      normalizedHash = computeContentHash(normalized);
      newContentForChange = normalized;
    }

    // 持久保存原始快照（位元組本身），即使沒有 KnowledgeRecord 可比對也要存（見上方函式註解第 4 項）。
    // 快照寫入本身若失敗，視為整次抓取失敗（不得把「未持久保存的內容」記為成功，第 6/F 項）。
    const snapshot: CrawlerSnapshot = {
      id: generateId("CSNAP"),
      sourceId,
      crawlerRunId: runId,
      fetchedAt: startedAt,
      contentType: fetched.contentType ?? null,
      rawBytes,
      rawHash,
      normalizedHash,
      extractionMethodVersion: isPdf ? "none" : HTML_NORMALIZE_VERSION,
      createdAt: nowTaipeiISOString(),
    };
    await repo.insertSnapshot(snapshot);
    savedSnapshotId = snapshot.id;

    const baseline = await repo.findLatestRecordBySourceId(sourceId);

    let changesDetected = 0;
    let changeCreated = false;
    if (baseline) {
      // 不知道基準當初是用哪種表示法建立（docs/knowledge/source-registry.md 對不同來源不一致，
      // 見檔頭說明），任一種相符就視為未變更，不得只試單一表示法。
      const matchesBaseline = baseline.contentHash === rawHash || (normalizedHash !== null && baseline.contentHash === normalizedHash);
      if (!matchesBaseline) {
        // 記錄哪一種表示法當作「新內容雜湊」：PDF 用原始位元組雜湊，文字來源用正規化文字雜湊——
        // 跟匯入時的慣例一致，供人工審核時可重現比對。
        const newContentHash = isPdf ? rawHash : (normalizedHash as string);
        // insertKnowledgeChange 本身具備冪等性（同一 knowledgeRecordId + newContentHash 若已有
        // 未審核中的 NEEDS_REVIEW，不會重複建立，見 repositories 實作與 migration 的唯一索引）：
        // 同一筆尚未審核的變更被重跑／重試／併發偵測到，不會產生第二筆 NEEDS_REVIEW（B-009-r2 修正）。
        const { inserted } = await repo.insertKnowledgeChange({
          id: generateId("KCHG"),
          knowledgeRecordId: baseline.id,
          oldContentHash: baseline.contentHash,
          newContentHash,
          oldContent: baseline.rawText,
          newContent: newContentForChange,
          aiSummary: null,
          status: "NEEDS_REVIEW",
          detectedAt: nowTaipeiISOString(),
          reviewedAt: null,
          reviewedBy: null,
        });
        changeCreated = inserted;
        changesDetected = inserted ? 1 : 0;
      }
    }

    const run: CrawlerRun = {
      id: runId,
      sourceId,
      startedAt,
      finishedAt: nowTaipeiISOString(),
      status: "SUCCESS",
      itemsChecked: 1,
      changesDetected,
      contentHash: isPdf ? rawHash : (normalizedHash ?? rawHash),
      snapshotId: snapshot.id,
      errorMessage: null,
    };
    await repo.insertCrawlerRun(run);
    return { run, changeCreated };
  } catch (err) {
    // 不另建一筆 FAILED 留下原 RUNNING；已持久保存的快照仍掛回同一筆失敗紀錄。
    const message = err instanceof Error ? err.message : String(err);
    const run = failedRun(runId, sourceId, startedAt, `Repository 呼叫失敗：${message}`);
    run.snapshotId = savedSnapshotId;
    await repo.insertCrawlerRun(run);
    return { run, changeCreated: false };
  }
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
    try {
      const { run } = await crawlSource(repo, sourceId, entry.url, fetcher);
      runs.push(run);
    } catch (err) {
      // crawlSource 內部呼叫 Repository（findLatestRecordBySourceId／insertKnowledgeChange／
      // insertCrawlerRun／insertSnapshot）本身丟出例外（例如資料庫暫時無法連線），視為這個來源的
      // 失敗，不得中止其餘來源的抓取（Jerry PR #37 第 5 項：個別來源失敗不阻斷其他來源）。
      // 嘗試補記一筆 FAILED CrawlerRun；若連這筆都寫不進去，代表 Repository 整體已不可用，
      // 此時讓例外往外拋、中止整支排程——不得悄悄略過讓人誤以為所有來源都已檢查過（第 5 項後段）。
      const message = err instanceof Error ? err.message : String(err);
      const fallbackRun = failedRun(generateId("CRUN"), sourceId, nowTaipeiISOString(), `Repository 呼叫失敗：${message}`);
      await repo.insertCrawlerRun(fallbackRun);
      runs.push(fallbackRun);
    }
  }

  const failedCount = runs.filter((r) => r.status === "FAILED").length;
  const overallStatus: CrawlerRunStatus =
    runs.length === 0 || failedCount === 0 ? "SUCCESS" : failedCount === runs.length ? "FAILED" : "PARTIAL";
  return { runs, overallStatus };
}
