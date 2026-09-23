// 手動執行用的 Import Script（不在 API 執行期路徑中）。先 build，再執行編譯後的版本：
//   npm run build
//   node dist/scripts/importProviderDataset.js --dry-run [datasetDir]   # 只驗證、產生報告，永不寫入
//   node dist/scripts/importProviderDataset.js --commit  [datasetDir]   # 正式匯入（需 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）
// 必須明確指定 --dry-run 或 --commit，不提供預設模式。
// 預設 datasetDir 指向 /data/providers/staging。
//
// Exit code：0 = 無任何拒收（dry-run 驗證通過，或 commit 已寫入）；1 = 有拒收（未寫入任何資料）或執行錯誤；
// 2 = 參數錯誤。
//
// 依 tasks/TASK-B-004.md：正式資料匯入必須等待 A-004 validator 通過，使用 A-003 校正後版本。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hasRejections, importProviderDataset } from "../services/providerImportService.js";
import { SupabaseProviderRepository } from "../repositories/supabaseProviderRepository.js";
import type { ProviderImportDataset, ProviderImportMode } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function parseArgs(argv: string[]): { mode: ProviderImportMode; datasetDir: string } | null {
  const flags = argv.filter((a) => a.startsWith("--"));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const isDryRun = flags.includes("--dry-run");
  const isCommit = flags.includes("--commit");

  if (isDryRun === isCommit) return null;

  return {
    mode: isDryRun ? "dry-run" : "commit",
    datasetDir: positional[0] ?? path.resolve(__dirname, "../../../../data/providers/staging"),
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("請明確指定 --dry-run 或 --commit 其中一個。");
    return 2;
  }

  const dataset: ProviderImportDataset = {
    providers: readJson(path.join(args.datasetDir, "providers.json")) as ProviderImportDataset["providers"],
    providerServices: readJson(
      path.join(args.datasetDir, "provider-services.json")
    ) as ProviderImportDataset["providerServices"],
    providerServiceAreas: readJson(
      path.join(args.datasetDir, "provider-service-areas.json")
    ) as ProviderImportDataset["providerServiceAreas"],
  };

  const report = await importProviderDataset(new SupabaseProviderRepository(), dataset, { mode: args.mode });

  console.log(`Mode: ${report.mode}`);
  console.log(`Providers valid: ${report.providersValid}, rejected: ${report.providersRejected.length}`);
  console.log(`Services valid: ${report.servicesValid}, rejected: ${report.servicesRejected.length}`);
  console.log(`Service Areas valid: ${report.serviceAreasValid}, rejected: ${report.serviceAreasRejected.length}`);
  if (report.written && report.writtenCounts) {
    const c = report.writtenCounts;
    console.log(
      `Result: DATA WRITTEN in one transaction (providers: ${c.providers}, ` +
        `provider_services: ${c.providerServices}, provider_service_areas: ${c.providerServiceAreas})`
    );
  } else {
    console.log("Result: NO DATA WRITTEN");
  }

  if (hasRejections(report)) {
    console.log("\n--- Rejected Records (need A to fix source data) ---");
    console.log(
      JSON.stringify(
        {
          providersRejected: report.providersRejected,
          servicesRejected: report.servicesRejected,
          serviceAreasRejected: report.serviceAreasRejected,
        },
        null,
        2
      )
    );
    return 1;
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Import failed:", err);
    process.exitCode = 1;
  });
