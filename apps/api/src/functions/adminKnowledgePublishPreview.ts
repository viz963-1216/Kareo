import { enforceAdminIpLimit, enforceAdminOperatorLimit } from "../services/adminRequestSecurity.js";
import { requireAdminSession } from "../services/adminAuthService.js";
import { getPublishPreview } from "../services/adminKnowledgeService.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { adminSuccessResponse, adminErrorResponse, adminInternalErrorResponse } from "../lib/adminResponse.js";
import { getAdminTokenHeader } from "../lib/headers.js";
import type { HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
}

// GET /api/v1/admin/knowledge/publish-preview
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/admin/knowledge/publish-preview。"));
  }

  try {
    await enforceAdminIpLimit(event);
    const repo = new SupabaseAdminKnowledgeRepository();
    const operator = await requireAdminSession(repo, getAdminTokenHeader(event));
    await enforceAdminOperatorLimit(operator.id, false);
    const result = await getPublishPreview(repo);
    return adminSuccessResponse(result);
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
