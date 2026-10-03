// 受保護的內部指令（不對外提供 API），依 contracts/knowledge/README.md §3、DATA_MODEL §26b（D-16c）。
// 用法（需先 npm run build；需 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   node dist/scripts/importKnowledgePack.js --dry-run <content-pack.json> [source-registry.md]
//   KAREO_OPERATOR_KEY=<key> node dist/scripts/importKnowledgePack.js --commit --operator-id <InternalOperator ID> <content-pack.json> [source-registry.md]
// --commit 重用既有 InternalOperator 個人密鑰與 KNOWLEDGE_PUBLISHER 角色驗證；密鑰只從環境變數讀取，
// 不接受命令列參數（避免留在 shell history／log）。缺身分、密鑰錯誤、停用或無角色時，在讀檔與任何寫入前拒絕。
// --dry-run 不寫入、不需要操作者身分，也不建立任何稽核。
// 預設 source-registry.md 路徑指向 docs/knowledge/source-registry.md（Jerry 維護，本工具只讀取）。
// Exit code：0 = 無拒收；1 = 有拒收、操作者驗證失敗或執行錯誤；2 = 參數錯誤。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { importContentPack, parseSourceRegistry } from "../services/knowledgeImportService.js";
import { requireOperator } from "../services/internalOperatorService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { AppError } from "../errors/AppError.js";
import type { KnowledgeRepository, LeadRepository } from "../repositories/types.js";
import type { KnowledgeImportMode, RawContentPack } from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ImportArgs {
  mode: KnowledgeImportMode;
  operatorId: string | null;
  packPath: string;
  registryPath: string;
}

// --dry-run／--commit 是布林旗標（不吃下一個參數），只有 --operator-id 帶值；其他旗標一律視為參數錯誤
// （例如 --operator-key：密鑰不得走命令列）。
function parseArgs(argv: string[]): ImportArgs | null {
  let isDryRun = false;
  let isCommit = false;
  let operatorId: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") isDryRun = true;
    else if (arg === "--commit") isCommit = true;
    else if (arg === "--operator-id" || arg.startsWith("--operator-id=")) {
      const value = arg === "--operator-id" ? argv[++i] : arg.slice("--operator-id=".length);
      if (value === undefined || value.startsWith("--") || value.trim().length === 0) return null;
      operatorId = value;
    } else if (arg.startsWith("--")) return null;
    else positional.push(arg);
  }
  if (isDryRun === isCommit) return null;
  if (!positional[0] || positional.length > 2) return null;

  return {
    mode: isDryRun ? "dry-run" : "commit",
    operatorId,
    packPath: positional[0],
    registryPath: positional[1] ?? path.resolve(__dirname, "../../../../docs/knowledge/source-registry.md"),
  };
}

export interface ImportCliDeps {
  knowledgeRepo: KnowledgeRepository;
  operatorRepo: Pick<LeadRepository, "findOperatorById">;
  readFile: (filePath: string) => string;
  log: (message: string) => void;
  error: (message: string) => void;
}

// 正式入口（main 只負責組裝 Supabase repository）；測試直接呼叫本函式驗證負向情境。
export async function runImportKnowledgePackCli(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: ImportCliDeps
): Promise<number> {
  const args = parseArgs(argv);
  if (!args) {
    deps.error("用法：--dry-run <content-pack.json> [source-registry.md]｜--commit --operator-id <id> <content-pack.json> [source-registry.md]（密鑰以 KAREO_OPERATOR_KEY 環境變數提供）");
    return 2;
  }

  let importedBy: string | null = null;
  if (args.mode === "commit") {
    try {
      const operator = await requireOperator(deps.operatorRepo, args.operatorId, env.KAREO_OPERATOR_KEY, "KNOWLEDGE_PUBLISHER");
      importedBy = operator.id;
    } catch (err) {
      if (err instanceof AppError && (err.code === "SESSION_INVALID" || err.code === "FORBIDDEN")) {
        deps.error(`操作者驗證失敗（${err.code}）：${err.message} 未寫入任何資料。`);
        return 1;
      }
      throw err;
    }
  }

  const pack = JSON.parse(deps.readFile(args.packPath)) as RawContentPack;
  const registry = parseSourceRegistry(deps.readFile(args.registryPath));

  const report = await importContentPack(deps.knowledgeRepo, pack, registry, { mode: args.mode, importedBy });

  deps.log(`Mode: ${report.mode}`);
  if (importedBy) deps.log(`Operator: ${importedBy}`);
  deps.log(`Pack: ${report.packId ?? "(invalid)"}`);
  deps.log(`Records valid: ${report.recordsValid}, rejected: ${report.recordsRejected.length}`);
  deps.log(report.written ? "Result: DATA WRITTEN" : "Result: NO DATA WRITTEN");

  if (report.recordsRejected.length > 0) {
    deps.log("\n--- Rejected Records ---");
    deps.log(JSON.stringify(report.recordsRejected, null, 2));
    return 1;
  }
  return 0;
}

// 只有直接執行本檔時才跑 CLI；被測試或其他模組 import 時不得自動連線 Supabase。
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runImportKnowledgePackCli(process.argv.slice(2), process.env, {
    knowledgeRepo: new SupabaseKnowledgeRepository(),
    operatorRepo: new SupabaseAdminKnowledgeRepository(),
    readFile: (p) => readFileSync(p, "utf-8"),
    log: (m) => console.log(m),
    error: (m) => console.error(m),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error("Import failed:", err);
      process.exitCode = 1;
    });
}
