// 受保護的內部指令（不對外提供 API），依 contracts/knowledge/README.md §3。
// 用法（需先 npm run build；--commit 需 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   node dist/scripts/importKnowledgePack.js --dry-run|--commit <content-pack.json> [source-registry.md]
// 預設 source-registry.md 路徑指向 docs/knowledge/source-registry.md（Jerry 維護，本工具只讀取）。
// Exit code：0 = 無拒收；1 = 有拒收或執行錯誤；2 = 參數錯誤。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { importContentPack, parseSourceRegistry } from "../services/knowledgeImportService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import type { KnowledgeImportMode, RawContentPack } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): { mode: KnowledgeImportMode; packPath: string; registryPath: string } | null {
  const flags = argv.filter((a) => a.startsWith("--"));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const isDryRun = flags.includes("--dry-run");
  const isCommit = flags.includes("--commit");
  if (isDryRun === isCommit) return null;
  if (!positional[0]) return null;

  return {
    mode: isDryRun ? "dry-run" : "commit",
    packPath: positional[0],
    registryPath: positional[1] ?? path.resolve(__dirname, "../../../../docs/knowledge/source-registry.md"),
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("用法：--dry-run|--commit <content-pack.json> [source-registry.md]");
    return 2;
  }

  const pack = JSON.parse(readFileSync(args.packPath, "utf-8")) as RawContentPack;
  const registry = parseSourceRegistry(readFileSync(args.registryPath, "utf-8"));

  const report = await importContentPack(new SupabaseKnowledgeRepository(), pack, registry, { mode: args.mode });

  console.log(`Mode: ${report.mode}`);
  console.log(`Pack: ${report.packId ?? "(invalid)"}`);
  console.log(`Records valid: ${report.recordsValid}, rejected: ${report.recordsRejected.length}`);
  console.log(report.written ? "Result: DATA WRITTEN" : "Result: NO DATA WRITTEN");

  if (report.recordsRejected.length > 0) {
    console.log("\n--- Rejected Records ---");
    console.log(JSON.stringify(report.recordsRejected, null, 2));
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
