import { requireBodySize } from "../services/requestLimitsService.js";
import { enforceAdminIpLimit, enforceAdminOperatorLimit } from "../services/adminRequestSecurity.js";
import { requireAdminSession } from "../services/adminAuthService.js";
import { dismissKnowledgeChange } from "../services/adminKnowledgeService.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { adminSuccessResponse, adminErrorResponse, adminInternalErrorResponse } from "../lib/adminResponse.js";
import { getAdminTokenHeader } from "../lib/headers.js";
import type { HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  path?: string;
  rawUrl?: string;
  headers?: Record<string, string | undefined> | null;
  body: string | null;
  queryStringParameters?: Record<string, string | undefined> | null;
}

const CHANGE_PATH = /\/api\/v1\/admin\/knowledge\/changes\/([^/?#]+)\/dismiss\/?$/;

function idFromPath(path: string | undefined): string | undefined {
  const match = path?.match(CHANGE_PATH);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

function idFromRawUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return idFromPath(new URL(rawUrl).pathname);
  } catch {
    return undefined;
  }
}

export function extractChangeId(event: NetlifyEvent): string | undefined {
  return idFromPath(event.path) ?? idFromRawUrl(event.rawUrl) ?? event.queryStringParameters?.id;
}

// POST /api/v1/admin/knowledge/changes/{id}/dismiss
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/admin/knowledge/changes/{id}/dismiss。"));
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
    const result = await dismissKnowledgeChange(repo, operator.id, extractChangeId(event), parsedBody);
    return adminSuccessResponse(result);
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
