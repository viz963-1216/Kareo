import { withdrawConsent } from "../services/consentService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { getSessionTokenHeader } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
}

// POST /api/v1/consent/withdraw：依 API_CONTRACT §7 v0.2（TASK-B-011b），需要 X-Kareo-Session-Token，無 Body。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/consent/withdraw。"));
  }

  try {
    const result = await withdrawConsent(
      new SupabaseSessionRepository(),
      new SupabaseConsentRepository(),
      getSessionTokenHeader(event)
    );
    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
