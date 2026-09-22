// 手動執行用的 Import Script（不在 API 執行期路徑中）。
// 用法（需先在環境變數設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   node --experimental-strip-types src/scripts/importProviderDataset.ts [datasetDir]
// 預設 datasetDir 指向 /data/providers/staging（A 提供、Jerry Review 過的 staging dataset）。
//
// 依 tasks/TASK-B-004.md：正式資料匯入必須等待 A-004 validator 通過，使用 A-003 校正後版本。
// 本 Script 目前讀取的是 A-002 staging dataset，僅供建模/試匯入使用，
// 執行後務必檢查輸出的 Import Report，確認沒有非預期的拒收筆數。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { importProviderDataset } from "../services/providerImportService.js";
import { SupabaseProviderRepository } from "../repositories/supabaseProviderRepository.js";
import type { ProviderImportDataset } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

async function main() {
  const datasetDir =
    process.argv[2] ?? path.resolve(__dirname, "../../../../data/providers/staging");

  const dataset: ProviderImportDataset = {
    providers: readJson(path.join(datasetDir, "providers.json")) as ProviderImportDataset["providers"],
    providerServices: readJson(
      path.join(datasetDir, "provider-services.json")
    ) as ProviderImportDataset["providerServices"],
    providerServiceAreas: readJson(
      path.join(datasetDir, "provider-service-areas.json")
    ) as ProviderImportDataset["providerServiceAreas"],
  };

  const report = await importProviderDataset(new SupabaseProviderRepository(), dataset);

  console.log(`Providers accepted: ${report.providersAccepted}, rejected: ${report.providersRejected.length}`);
  console.log(`Services accepted: ${report.servicesAccepted}, rejected: ${report.servicesRejected.length}`);
  console.log(
    `Service Areas accepted: ${report.serviceAreasAccepted}, rejected: ${report.serviceAreasRejected.length}`
  );

  if (report.providersRejected.length > 0 || report.servicesRejected.length > 0 || report.serviceAreasRejected.length > 0) {
    console.log("\n--- Rejected Records (need A to fix source data) ---");
    console.log(JSON.stringify({
      providersRejected: report.providersRejected,
      servicesRejected: report.servicesRejected,
      serviceAreasRejected: report.serviceAreasRejected,
    }, null, 2));
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exitCode = 1;
});
