import { createConsent } from "../services/consentService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { RealConsentVersionChecker } from "../services/consentVersionService.js";
import { requireValidSession } from "../services/sessionSecurityService.js";
import { enforceRateLimit, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { requireBodySize } from "../services/requestLimitsService.js";
import { successResponse, internalErrorResponse, errorResponse, nowTaipeiISOString, type HttpResponse } from "../lib/response.js";
import { getSessionTokenHeader } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers?: Record<string, string | undefined> | null;
}

// POST /api/v1/consent：依 API_CONTRACT §3.1 v0.2，需要 X-Kareo-Session-Token。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/consent。"));
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
    await enforceRateLimit(new SupabaseRateLimitRepository(), RATE_LIMIT_RULES.CONSENT, session.id, nowTaipeiISOString());

    const consent = await createConsent(
      sessionRepo,
      new SupabaseConsentRepository(),
      new RealConsentVersionChecker(),
      parsedBody,
      getSessionTokenHeader(event)
    );
    return successResponse({ consentId: consent.id, acceptedAt: consent.acceptedAt });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
