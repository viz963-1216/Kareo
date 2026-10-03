import { getKnowledgeRecords } from "../services/knowledgeRecordsService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined> | null;
}

// GET /api/v1/knowledge/records：公開端點（API_CONTRACT §13a，v0.6），不需要 X-Kareo-Session-Token。
// 限流（120 次／小時，ARCHITECTURE §20.4）沿用 B-011 元件；該元件尚未合併進 staging，列為 Known Issue
// （見 PR 說明），由 B-011b 追蹤。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/knowledge/records。"));
  }

  try {
    const result = await getKnowledgeRecords(new SupabaseKnowledgeRepository(), event.queryStringParameters);
    return successResponse(result);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
