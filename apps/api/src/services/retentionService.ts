// TASK-B-011b：每日到期清理作業，依 PRIVACY_AND_RETENTION §6.3、DATA_MODEL §40。
// 支援 dry-run（只計算、不寫入 deletion_runs）；失敗寫入 status=FAILED（不含個資的錯誤訊息），
// 可重試（下一次執行只處理屆時仍符合條件的 session，失敗這次未刪除的資料不會被跳過）。
import type { SessionRepository } from "../repositories/types.js";
import type { DeletionRun } from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export async function runRetentionCleanup(
  repo: SessionRepository,
  options: { dryRun: boolean; operatorId: string | null; now?: string }
): Promise<DeletionRun> {
  const startedAt = options.now ?? nowTaipeiISOString();
  const id = generateId("DRUN");

  try {
    const { sessionsDeleted, leadsContactCleared, leadsDeleted, consentsDeleted } = await repo.runDeletionCleanup({
      now: startedAt,
      dryRun: options.dryRun,
    });
    const finishedAt = nowTaipeiISOString();
    const run: DeletionRun = {
      id,
      startedAt,
      finishedAt,
      dryRun: options.dryRun,
      status: "SUCCESS",
      sessionsDeleted,
      leadsContactCleared,
      leadsDeleted,
      consentsDeleted,
      errorMessage: null,
      operatorId: options.operatorId,
    };
    if (!options.dryRun) await repo.insertDeletionRun(run);
    return run;
  } catch (err) {
    const finishedAt = nowTaipeiISOString();
    const run: DeletionRun = {
      id,
      startedAt,
      finishedAt,
      dryRun: options.dryRun,
      status: "FAILED",
      sessionsDeleted: 0,
      leadsContactCleared: 0,
      leadsDeleted: 0,
      consentsDeleted: 0,
      // 依 DATA_MODEL §40：errorMessage 不得包含個資；只記錄分類訊息，不帶出原始例外內容
      // （可能含 SQL 或內部細節）。
      errorMessage: "清理作業執行失敗，請查看伺服器 log。",
      operatorId: options.operatorId,
    };
    if (!options.dryRun) await repo.insertDeletionRun(run);
    throw err;
  }
}
