// 受保護的內部指令，依 PRIVACY_AND_RETENTION §6.3：每日到期清理作業（需授權角色執行）。
// 用法（需先 npm run build；需 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   KAREO_OPERATOR_KEY=<key> node dist/scripts/cleanupExpiredData.js --dry-run|--commit --operator-id <InternalOperator ID>
// 操作者必須是有效的 InternalOperator 且具 DATA_STEWARD 角色（DATA_MODEL §36；RELEASE_RUNBOOK 把刪除請求
// 交給 DATA_STEWARD）。個人密鑰只從環境變數讀取，不接受命令列參數（避免留在 shell history／log）。
// 驗證在任何資料庫讀寫之前執行，dry-run 也一樣（它會查詢正式資料庫）。deletion_runs.operator_id 記錄的是
// 驗證通過的操作者 ID，不是呼叫端自稱的字串。
// --dry-run 只計算將處理的筆數，不實際刪除、不寫入 deletion_runs。
// 輸出只有筆數與類型，不輸出個資（依 §6.3「輸出將刪除筆數與類型（不輸出個資）」）。
// Exit code：0 = 成功；1 = 操作者驗證失敗或清理失敗；2 = 參數錯誤。
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runRetentionCleanup } from "../services/retentionService.js";
import { requireOperator } from "../services/internalOperatorService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseLeadRepository } from "../repositories/supabaseLeadRepository.js";
import { AppError } from "../errors/AppError.js";
import type { LeadRepository, SessionRepository } from "../repositories/types.js";

const __filename = fileURLToPath(import.meta.url);

interface CleanupArgs {
  dryRun: boolean;
  operatorId: string | null;
}

// --dry-run／--commit 是布林旗標；只有 --operator-id 帶值；其他旗標（例如 --operator-key）與多餘參數一律視為參數錯誤。
function parseArgs(argv: string[]): CleanupArgs | null {
  let isDryRun = false;
  let isCommit = false;
  let operatorId: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") isDryRun = true;
    else if (arg === "--commit") isCommit = true;
    else if (arg === "--operator-id" || arg.startsWith("--operator-id=")) {
      const value = arg === "--operator-id" ? argv[++i] : arg.slice("--operator-id=".length);
      if (value === undefined || value.startsWith("--") || value.trim().length === 0) return null;
      operatorId = value;
    } else return null;
  }
  if (isDryRun === isCommit) return null;
  return { dryRun: isDryRun, operatorId };
}

export interface CleanupCliDeps {
  sessionRepo: SessionRepository;
  operatorRepo: LeadRepository;
  log: (message: string) => void;
  error: (message: string) => void;
}

// 正式入口（直接執行時由下方組裝 Supabase repository）；測試直接呼叫本函式驗證負向情境。
export async function runCleanupCli(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: CleanupCliDeps,
  now?: string
): Promise<number> {
  const args = parseArgs(argv);
  if (!args) {
    deps.error("用法：--dry-run|--commit --operator-id <id>（密鑰以 KAREO_OPERATOR_KEY 環境變數提供）");
    return 2;
  }

  let operatorId: string;
  try {
    operatorId = (await requireOperator(deps.operatorRepo, args.operatorId, env.KAREO_OPERATOR_KEY, "DATA_STEWARD")).id;
  } catch (err) {
    if (err instanceof AppError && (err.code === "SESSION_INVALID" || err.code === "FORBIDDEN")) {
      deps.error(`操作者驗證失敗（${err.code}）：${err.message} 未執行任何清理。`);
      return 1;
    }
    throw err;
  }

  const run = await runRetentionCleanup(deps.sessionRepo, { dryRun: args.dryRun, operatorId, now });

  deps.log(`Mode: ${run.dryRun ? "dry-run" : "commit"}`);
  deps.log(`Operator: ${operatorId}`);
  deps.log(`Status: ${run.status}`);
  deps.log(`Sessions deleted (deletion/withdraw requests + 90-day idle): ${run.sessionsDeleted}`);
  deps.log(`Lead contact fields cleared (180-day): ${run.leadsContactCleared}`);
  deps.log(`Leads deleted (1-year): ${run.leadsDeleted}`);
  deps.log(`Consents deleted (3-year): ${run.consentsDeleted}`);
  return run.status === "SUCCESS" ? 0 : 1;
}

// 只有直接執行本檔時才跑 CLI；被測試或其他模組 import 時不得自動連線 Supabase。
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCleanupCli(process.argv.slice(2), process.env, {
    sessionRepo: new SupabaseSessionRepository(),
    operatorRepo: new SupabaseLeadRepository(),
    log: (m) => console.log(m),
    error: (m) => console.error(m),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error("Cleanup failed:", err);
      process.exitCode = 1;
    });
}
