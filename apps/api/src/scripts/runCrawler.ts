// 受保護的內部指令，依 PRODUCT_SPEC §42：每天 00:10 Asia/Taipei 觸發一次，對 Source Registry
// 全部 active、非 KAREO_DRIVE 的來源各抓取一次，只寫入 CrawlerRun／KnowledgeChange，
// 永遠不自動核准或發布（§43）。
//
// 用法（需先 npm run build；需 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   node dist/scripts/runCrawler.js [source-registry.md]
//
// 排程設定（B-009-r2 更新：J-003 已在 .github/workflows/knowledge-crawler.yml 接上 GitHub Actions
// 排程，本指令不再需要另外接 Netlify Scheduled Function；.github/workflows/** 不在 B-009 Allowed
// Paths 內，本檔只確保 CLI 契約與該 workflow 相容：無參數執行時使用預設 source-registry.md 路徑、
// exit code 0=SUCCESS／1=PARTIAL 或 FAILED，皆已符合該 workflow 最後一步的期待）：
//   目標時間 00:10 Asia/Taipei = 16:10 UTC（無日光節約時間問題，Asia/Taipei 全年 UTC+8）。
//   cron 表達式：`10 16 * * *`（見 .github/workflows/knowledge-crawler.yml）。
//
// 審核人操作說明（找不到 contracts/knowledge/README.md 內對應章節可加這段——該檔不在 B-009
// Allowed Paths 內，這裡先留操作說明，供 Jerry／J-002 決定是否要搬過去）：
//   1. 每次執行後，console 輸出逐來源的 CrawlerRun 結果（SUCCESS／FAILED／變更數）；
//      正式環境請改查 crawler_runs 資料表（依 started_at 排序）看每日紀錄。
//   2. 當某來源產生 KnowledgeChange（status=NEEDS_REVIEW），查 knowledge_changes 資料表，
//      比對 old_content／new_content 判斷是否為實質內容變更（PDF 來源的內容是原始位元組，
//      不可讀，需另外開啟 source_url 看實際 PDF——見 crawlerService.ts 的已知限制說明）。
//   3. 確認是實質變更後，比照 B-008 流程製作新的內容包（contracts/knowledge/packs/），
//      走 importKnowledgePack → approveKnowledgePack → publishKnowledgeVersion 三步驟，
//      不會因為 Crawler 偵測到變更就自動更新 knowledge_records 或發布新版本（PRODUCT_SPEC §43）。
//   4. 判斷不是實質變更（例如版型調整）：目前沒有「標記已讀」的指令，KnowledgeChange 會留在
//      NEEDS_REVIEW；後續處理方式（例如新增 dismiss 指令）留給後續任務決定，屬規格缺口。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { crawlAllActiveSources, createHttpFetcher } from "../services/crawlerService.js";
import { parseSourceRegistry } from "../services/knowledgeImportService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<number> {
  const registryPath = process.argv[2] ?? path.resolve(__dirname, "../../../../docs/knowledge/source-registry.md");
  const registryMd = readFileSync(registryPath, "utf-8");
  const registry = parseSourceRegistry(registryMd);

  const repo = new SupabaseKnowledgeRepository();
  const fetcher = createHttpFetcher();

  const { runs, overallStatus } = await crawlAllActiveSources(repo, registry, fetcher);

  for (const run of runs) {
    console.log(
      `${run.sourceId}: ${run.status}` +
        (run.status === "FAILED" ? ` (${run.errorMessage})` : ` — changesDetected=${run.changesDetected}`)
    );
  }
  console.log(`Overall: ${overallStatus} (${runs.length} sources checked)`);

  // FAILED／PARTIAL 不代表本次執行本身出錯（每個來源都已個別記錄到 CrawlerRun），
  // 但用非零結束碼讓外部排程系統能收到警訊、通知人工檢查。
  return overallStatus === "SUCCESS" ? 0 : 1;
}

main()
  .then((code) => (process.exitCode = code))
  .catch((err) => {
    console.error("Crawler run failed:", err);
    process.exitCode = 1;
  });
