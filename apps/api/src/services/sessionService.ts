import type { SessionRepository } from "../repositories/types.js";
import type { CreatedSession } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { nowTaipeiISOString } from "../lib/response.js";
import { requireValidSession } from "./sessionSecurityService.js";
import type { DeletionJournal } from "../privacy/deletionJournal.js";
import { persistDeletionIntent } from "../privacy/persistDeletionIntent.js";

export async function createSession(repo: SessionRepository): Promise<CreatedSession> {
  return repo.createSession();
}

// 依 API_CONTRACT §6 DELETE /api/v1/session、PRIVACY_AND_RETENTION §6.1：
// 使用者刪除自己的資料，呼叫後 token 立即失效；重複呼叫回 SESSION_INVALID
// （requireValidSession 在這之前已經確保目前仍是 ACTIVE，轉為 DELETION_REQUESTED 後
// 下一次呼叫 requireValidSession 會因 status !== ACTIVE 直接回 SESSION_INVALID）。
export async function deleteSession(
  repo: SessionRepository,
  sessionTokenHeader: unknown,
  journal?: DeletionJournal
): Promise<{ sessionId: string; status: "DELETION_REQUESTED"; deletionScheduledBefore: string }> {
  const session = await requireValidSession(repo, sessionTokenHeader);
  const now = await persistDeletionIntent(journal,session.id,"USER_DELETED",nowTaipeiISOString());
  const { updated } = await repo.requestDeletion(session.id, now);
  if (!updated) {
    // requireValidSession 剛確認過是 ACTIVE，理論上不會落到這裡（除非極端的併發競態）；
    // 安全起見仍視為「已經不是有效 session」而非內部錯誤。
    throw new AppError("SESSION_INVALID", "Session 已失效。");
  }
  const deletionScheduledBefore = new Date(new Date(now).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { sessionId: session.id, status: "DELETION_REQUESTED", deletionScheduledBefore };
}
