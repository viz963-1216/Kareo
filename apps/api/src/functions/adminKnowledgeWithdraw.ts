import { requireBodySize } from "../services/requestLimitsService.js";
import { enforceAdminIpLimit, enforceAdminOperatorLimit } from "../services/adminRequestSecurity.js";
import { requireAdminSession } from "../services/adminAuthService.js";
import { withdrawKnowledgeVersion } from "../services/adminKnowledgeService.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { adminSuccessResponse, adminErrorResponse, adminInternalErrorResponse } from "../lib/adminResponse.js";
import { getAdminTokenHeader } from "../lib/headers.js";
import type { HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
  body: string | null;
}

// POST /api/v1/admin/knowledge/withdraw
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/admin/knowledge/withdraw。"));
  }

  let parsedBody: unknown;
  try {
    requireBodySize(event.body);
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminErrorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    await enforceAdminIpLimit(event);
    const repo = new SupabaseAdminKnowledgeRepository();
    const operator = await requireAdminSession(repo, getAdminTokenHeader(event));
    await enforceAdminOperatorLimit(operator.id, true);
    const result = await withdrawKnowledgeVersion(repo, operator.id, parsedBody);
    return adminSuccessResponse(result);
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
