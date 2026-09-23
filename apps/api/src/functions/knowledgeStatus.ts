import { getKnowledgeStatus } from "../services/knowledgeService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
}

// GET /api/v1/knowledge/status
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/knowledge/status。"));
  }

  try {
    const status = await getKnowledgeStatus(new SupabaseKnowledgeRepository());
    return successResponse(status);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
