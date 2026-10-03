// 受保護的內部指令，依 PRIVACY_AND_RETENTION §6.3：每日到期清理作業。
// 用法：node dist/scripts/cleanupExpiredData.js --dry-run|--commit [operatorId]
// --dry-run 只計算將刪除的 session 數量，不實際刪除、不寫入 deletion_runs。
// 輸出只有筆數與類型，不輸出個資（依 §6.3「輸出將刪除筆數與類型（不輸出個資）」）。
import { runRetentionCleanup } from "../services/retentionService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";

async function main(): Promise<number> {
  const flags = process.argv.slice(2);
  const isDryRun = flags.includes("--dry-run");
  const isCommit = flags.includes("--commit");
  if (isDryRun === isCommit) {
    console.error("用法：--dry-run|--commit [operatorId]");
    return 2;
  }
  const operatorId = flags.find((a) => !a.startsWith("--")) ?? null;

  const run = await runRetentionCleanup(new SupabaseSessionRepository(), { dryRun: isDryRun, operatorId });

  console.log(`Mode: ${run.dryRun ? "dry-run" : "commit"}`);
  console.log(`Status: ${run.status}`);
  console.log(`Sessions deleted (90-day idle / 7-day explicit-delete): ${run.sessionsDeleted}`);
  console.log(`Lead contact fields cleared (180-day): ${run.leadsContactCleared}`);
  console.log(`Leads deleted (1-year): ${run.leadsDeleted}`);
  console.log(`Consents deleted (3-year): ${run.consentsDeleted}`);
  return run.status === "SUCCESS" ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  });
