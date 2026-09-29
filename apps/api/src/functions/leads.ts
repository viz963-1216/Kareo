import { createLead } from "../services/leadService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { SupabaseAssessmentRepository } from "../repositories/supabaseAssessmentRepository.js";
import { SupabaseRecommendationRepository } from "../repositories/supabaseRecommendationRepository.js";
import { SupabaseLeadRepository } from "../repositories/supabaseLeadRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
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

  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch {
    return errorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    const result = await createLead(
      {
        sessionRepo: new SupabaseSessionRepository(),
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
