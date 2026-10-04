import { createLead } from "../services/leadService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { SupabaseAssessmentRepository } from "../repositories/supabaseAssessmentRepository.js";
import { SupabaseRecommendationRepository } from "../repositories/supabaseRecommendationRepository.js";
import { SupabaseLeadRepository } from "../repositories/supabaseLeadRepository.js";
import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { requireValidSession } from "../services/sessionSecurityService.js";
import { enforceRateLimit, hashForRateLimitKey, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { requireBodySize } from "../services/requestLimitsService.js";
import { successResponse, internalErrorResponse, errorResponse, nowTaipeiISOString, type HttpResponse } from "../lib/response.js";
import { getSessionTokenHeader, getIdempotencyKeyHeader } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers?: Record<string, string | undefined> | null;
}

// POST /api/v1/leads（路由由 J-003 於 netlify.toml 補，本檔只提供 function）。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/leads。"));
  }

  try {
    requireBodySize(event.body);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }

  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch {
    return errorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    const sessionRepo = new SupabaseSessionRepository();
    const session = await requireValidSession(sessionRepo, getSessionTokenHeader(event));
    const rateLimitRepo = new SupabaseRateLimitRepository();
    const now = nowTaipeiISOString();
    // 依 ARCHITECTURE §20.4：Lead 5 次／日（鍵為 session），同一電話 3 次／日（鍵為電話雜湊，
    // 電話存在 body 內才檢查；缺漏或格式錯誤由 createLead 的既有驗證回 VALIDATION_ERROR）。
    await enforceRateLimit(rateLimitRepo, RATE_LIMIT_RULES.LEAD, session.id, now);
    const phone =
      typeof parsedBody === "object" && parsedBody !== null
        ? (parsedBody as Record<string, unknown>).contact
        : undefined;
    const phoneValue = typeof phone === "object" && phone !== null ? (phone as Record<string, unknown>).phone : undefined;
    if (typeof phoneValue === "string" && phoneValue.length > 0) {
      await enforceRateLimit(rateLimitRepo, RATE_LIMIT_RULES.LEAD_PHONE, hashForRateLimitKey(phoneValue), now);
    }

    const result = await createLead(
      {
        sessionRepo,
        consentRepo: new SupabaseConsentRepository(),
        assessmentRepo: new SupabaseAssessmentRepository(),
        recommendationRepo: new SupabaseRecommendationRepository(),
        leadRepo: new SupabaseLeadRepository(),
      },
      parsedBody,
      getSessionTokenHeader(event),
      getIdempotencyKeyHeader(event)
    );

    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
