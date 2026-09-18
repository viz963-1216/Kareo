import type { ConsentRepository } from "../repositories/types.js";
import type { Consent, CreateConsentInput } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 依 docs/API_CONTRACT.md 第 7 節：accepted=false 時不得開始正式 Assessment，
// 本 Service 對應規則：accepted !== true 時不建立有效 Consent，直接回 VALIDATION_ERROR。
export function validateCreateConsentInput(body: unknown): CreateConsentInput {
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

  return {
    sessionId: input.sessionId,
    disclaimerVersion: input.disclaimerVersion,
    privacyVersion: input.privacyVersion,
    termsVersion: input.termsVersion,
    accepted: true,
  };
}

export async function createConsent(
  repo: ConsentRepository,
  body: unknown
): Promise<Consent> {
  const input = validateCreateConsentInput(body);
  return repo.createConsent(input);
}
