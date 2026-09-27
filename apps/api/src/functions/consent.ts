import { createConsent } from "../services/consentService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { RealConsentVersionChecker } from "../services/consentVersionService.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
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

  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch {
    return errorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    const consent = await createConsent(
      new SupabaseSessionRepository(),
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
