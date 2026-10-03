import { requireAdminSession } from "../services/adminAuthService.js";
import { listAdminRecords } from "../services/adminKnowledgeService.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { adminSuccessResponse, adminErrorResponse, adminInternalErrorResponse } from "../lib/adminResponse.js";
import { getAdminTokenHeader } from "../lib/headers.js";
import type { HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
}

// GET /api/v1/admin/knowledge/records?status=NEEDS_REVIEW
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/admin/knowledge/records。"));
  }

  try {
    const repo = new SupabaseAdminKnowledgeRepository();
    await requireAdminSession(repo, getAdminTokenHeader(event));
    const records = await listAdminRecords(repo, event.queryStringParameters?.status);
    return adminSuccessResponse({ records });
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
