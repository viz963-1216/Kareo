import type { ConsentRepository, SessionRepository } from "../repositories/types.js";
import type { Consent, CreateConsentInput } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { nowTaipeiISOString } from "../lib/response.js";
import type { ConsentVersionChecker } from "./consentVersionService.js";
import { requireMatchingSessionId, requireValidSession } from "./sessionSecurityService.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 依 docs/API_CONTRACT.md 第 7 節：accepted=false 時不得開始正式 Assessment，
// 本 Service 對應規則：accepted !== true 時不建立有效 Consent，直接回 VALIDATION_ERROR。
// v0.2（TASK-B-011a）：三個版本必須是 contracts/legal/consent-versions.json 中 ACTIVE 的組合
// （由呼叫端注入 ConsentVersionChecker，測試不受真實檔案目前內容影響）。
export function validateCreateConsentInput(body: unknown, versionChecker: ConsentVersionChecker): CreateConsentInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("INVALID_REQUEST", "請求格式錯誤。");
  }

  const input = body as Record<string, unknown>;

  if (!isNonEmptyString(input.sessionId)) {
    throw new AppError("VALIDATION_ERROR", "缺少有效的 sessionId。");
  }
  if (!isNonEmptyString(input.disclaimerVersion)) {
    throw new AppError("VALIDATION_ERROR", "缺少 disclaimerVersion。");
  }
  if (!isNonEmptyString(input.privacyVersion)) {
    throw new AppError("VALIDATION_ERROR", "缺少 privacyVersion。");
  }
  if (!isNonEmptyString(input.termsVersion)) {
    throw new AppError("VALIDATION_ERROR", "缺少 termsVersion。");
  }
  if (input.accepted !== true) {
    throw new AppError("VALIDATION_ERROR", "必須同意服務說明與免責聲明才能建立 Consent。");
  }
  if (!versionChecker.isActive(input.disclaimerVersion, input.privacyVersion, input.termsVersion)) {
    throw new AppError("VALIDATION_ERROR", "提交的條款版本組合目前不是有效版本。");
  }

  return {
    sessionId: input.sessionId,
    disclaimerVersion: input.disclaimerVersion,
    privacyVersion: input.privacyVersion,
    termsVersion: input.termsVersion,
    accepted: true,
  };
}

export async function createConsent(
  sessionRepo: SessionRepository,
  consentRepo: ConsentRepository,
  versionChecker: ConsentVersionChecker,
  body: unknown,
  sessionTokenHeader: unknown
): Promise<Consent> {
  const session = await requireValidSession(sessionRepo, sessionTokenHeader);
  // 先驗證 sessionId 一致，再做完整欄位驗證（跟 assessmentService 一樣的順序考量：
  // 先確認身分，再深入解析內容）。
  const bodySessionId =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).sessionId : undefined;
  requireMatchingSessionId(session, bodySessionId);

  const input = validateCreateConsentInput(body, versionChecker);
  return consentRepo.createConsent(input);
}

// 依 API_CONTRACT §7 POST /api/v1/consent/withdraw、PRIVACY_AND_RETENTION §3.3：撤回後該 session
// 不得再建立 Assessment／Recommendation／Lead，已提交的 Lead 標記 CANCELLED（CONSENT_WITHDRAWN），
// session 進入跟 DELETE /session 相同的刪除流程。updated=false（沒有仍生效的 Consent）時視為
// SESSION_INVALID（跟 deleteSession 對稱：並非真的 session token 失效，而是沒有「可撤回」的同意，
// 但依 API_CONTRACT §7 本端點沒有專屬錯誤碼，比照同樣代表「這個操作現在做不到」的 SESSION_INVALID）。
export async function withdrawConsent(
  sessionRepo: SessionRepository,
  consentRepo: ConsentRepository,
  sessionTokenHeader: unknown
): Promise<{ withdrawnAt: string; sessionStatus: "DELETION_REQUESTED" }> {
  const session = await requireValidSession(sessionRepo, sessionTokenHeader);
  const now = nowTaipeiISOString();
  const { updated } = await consentRepo.withdraw(session.id, now);
  if (!updated) {
    throw new AppError("SESSION_INVALID", "目前沒有可撤回的同意紀錄。");
  }
  return { withdrawnAt: now, sessionStatus: "DELETION_REQUESTED" };
}
