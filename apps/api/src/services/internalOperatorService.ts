// TASK-B-006：內部操作者身分驗證共用元件，依 docs/DATA_MODEL.md 第 36 節、docs/LEAD_OPERATIONS.md §2、4。
// 只供受保護的內部 CLI／管理 API 使用，不是一般 session 驗證（見 sessionSecurityService）。
import { createHash } from "node:crypto";
import type { LeadRepository } from "../repositories/types.js";
import type { InternalOperator, InternalOperatorRole } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

// 密鑰只存雜湊（同 sessionSecurityService.hashSessionToken 的模式），比對時重新雜湊，不存明文。
export function hashOperatorKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// 依 LEAD_OPERATIONS §4：每個指令都驗證操作者身分與權限；失敗一律視為未授權，不透露是操作者不存在、
// 已停用還是密鑰錯誤（避免被用來枚舉有效的 operatorId）。
// Lead 指令與知識匯入／回填指令（D-16c）共用；只需要能依 id 查操作者。
export async function requireOperator(
  repo: Pick<LeadRepository, "findOperatorById">,
  operatorId: unknown,
  keyPlaintext: unknown,
  requiredRole: InternalOperatorRole
): Promise<InternalOperator> {
  if (typeof operatorId !== "string" || operatorId.trim().length === 0) {
    throw new AppError("SESSION_INVALID", "缺少操作者身分。");
  }
  if (typeof keyPlaintext !== "string" || keyPlaintext.trim().length === 0) {
    throw new AppError("SESSION_INVALID", "缺少操作者密鑰。");
  }

  const operator = await repo.findOperatorById(operatorId);
  if (!operator || !operator.active || operator.revokedAt !== null) {
    throw new AppError("SESSION_INVALID", "操作者身分無效或已停用。");
  }
  if (hashOperatorKey(keyPlaintext) !== operator.keyHash) {
    throw new AppError("SESSION_INVALID", "操作者身分無效或已停用。");
  }
  if (!operator.roles.includes(requiredRole)) {
    throw new AppError("FORBIDDEN", "操作者沒有執行此操作的權限。");
  }
  return operator;
}
