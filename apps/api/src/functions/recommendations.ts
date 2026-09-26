import { createRecommendation } from "../services/recommendationService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseAssessmentRepository } from "../repositories/supabaseAssessmentRepository.js";
import { SupabaseProviderRepository } from "../repositories/supabaseProviderRepository.js";
import { SupabaseRecommendationRepository } from "../repositories/supabaseRecommendationRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { getSessionTokenHeader } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers?: Record<string, string | undefined> | null;
}

// POST /api/v1/recommendations（路由由 J-003 於 netlify.toml 補，本檔只提供 function）。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/recommendations。"));
  }

  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch {
    return errorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    const result = await createRecommendation(
      {
        sessionRepo: new SupabaseSessionRepository(),
        assessmentRepo: new SupabaseAssessmentRepository(),
        providerRepo: new SupabaseProviderRepository(),
        recommendationRepo: new SupabaseRecommendationRepository(),
      },
      parsedBody,
      getSessionTokenHeader(event)
    );

    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
