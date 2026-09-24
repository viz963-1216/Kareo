import type { ConsentRepository, SessionRepository } from "../repositories/types.js";
import type { Consent, CreateConsentInput } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
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
