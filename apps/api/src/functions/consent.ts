import { createConsent } from "../services/consentService.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
}

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
    const repo = new SupabaseConsentRepository();
    const consent = await createConsent(repo, parsedBody);
    return successResponse({ consentId: consent.id, acceptedAt: consent.acceptedAt });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
