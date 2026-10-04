import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { enforceClientIpRateLimit, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { nowTaipeiISOString } from "../lib/response.js";
import { getKnowledgeRecords, validateLookupQuery } from "../services/knowledgeRecordsService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
}

// GET /api/v1/knowledge/records：公開端點（API_CONTRACT §13a，v0.6），不需要 X-Kareo-Session-Token。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/knowledge/records。"));
  }

  try {
    validateLookupQuery(event.queryStringParameters);
    await enforceClientIpRateLimit(new SupabaseRateLimitRepository(), RATE_LIMIT_RULES.KNOWLEDGE_RECORDS, event, nowTaipeiISOString());
    const result = await getKnowledgeRecords(new SupabaseKnowledgeRepository(), event.queryStringParameters);
    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
