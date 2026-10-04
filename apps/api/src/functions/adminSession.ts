import { requireBodySize } from "../services/requestLimitsService.js";
import { enforceAdminIpLimit } from "../services/adminRequestSecurity.js";
import { createAdminSession } from "../services/adminAuthService.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { adminSuccessResponse, adminErrorResponse, adminInternalErrorResponse } from "../lib/adminResponse.js";
import type { HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined> | null;
  body: string | null;
}

// POST /api/v1/admin/session（路由由 J-003 於 netlify.toml 補，本檔只提供 function）。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/admin/session。"));
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
    await enforceAdminIpLimit(event, true);
    const result = await createAdminSession(new SupabaseAdminKnowledgeRepository(), parsedBody);
    return adminSuccessResponse(result);
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
