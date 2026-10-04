import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { enforceClientIpRateLimit, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { nowTaipeiISOString } from "../lib/response.js";
import { lookupProviders, validateLookupQuery } from "../services/providerLookupService.js";
import { SupabaseProviderRepository } from "../repositories/supabaseProviderRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
}

// GET /api/v1/providers：公開端點（API_CONTRACT §10a，v0.6），不需要 X-Kareo-Session-Token。
// 依 PRIVACY_AND_RETENTION §2：查詢條件（含 q）不得寫入 log，本檔不印出 event 或 query 內容。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/providers。"));
  }

  try {
    validateLookupQuery(event.queryStringParameters);
    await enforceClientIpRateLimit(new SupabaseRateLimitRepository(), RATE_LIMIT_RULES.PROVIDER_LOOKUP, event, nowTaipeiISOString());
    const result = await lookupProviders(new SupabaseProviderRepository(), event.queryStringParameters);
    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
