import { requireAdminSession } from "../services/adminAuthService.js";
import { listRestorableVersions } from "../services/adminKnowledgeService.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { adminSuccessResponse, adminErrorResponse, adminInternalErrorResponse } from "../lib/adminResponse.js";
import { getAdminTokenHeader } from "../lib/headers.js";
import type { HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
}

// GET /api/v1/admin/knowledge/restorable-versions
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/admin/knowledge/restorable-versions。"));
  }

  try {
    const repo = new SupabaseAdminKnowledgeRepository();
    await requireAdminSession(repo, getAdminTokenHeader(event));
    const result = await listRestorableVersions(repo);
    return adminSuccessResponse(result);
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
