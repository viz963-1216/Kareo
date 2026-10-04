import { requireBodySize } from "../services/requestLimitsService.js";
import { enforceAdminIpLimit, enforceAdminOperatorLimit } from "../services/adminRequestSecurity.js";
import { requireAdminSession } from "../services/adminAuthService.js";
import { decideKnowledgeRecord } from "../services/adminKnowledgeService.js";
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

const RECORD_PATH = /\/api\/v1\/admin\/knowledge\/records\/([^/?#]+)\/decision\/?$/;

function idFromPath(path: string | undefined): string | undefined {
  const match = path?.match(RECORD_PATH);
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

// 同 providerDetail.ts 既有模式：Netlify Functions 沒有 pathParameters，依序嘗試
// event.path、event.rawUrl，最後才是 ?id=（直接呼叫函式時用）。
export function extractRecordId(event: NetlifyEvent): string | undefined {
  return idFromPath(event.path) ?? idFromRawUrl(event.rawUrl) ?? event.queryStringParameters?.id;
}

// POST /api/v1/admin/knowledge/records/{id}/decision
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return adminErrorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/admin/knowledge/records/{id}/decision。"));
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
    const result = await decideKnowledgeRecord(repo, operator.id, extractRecordId(event), parsedBody);
    return adminSuccessResponse(result);
  } catch (err) {
    if (err instanceof AppError) return adminErrorResponse(err);
    return adminInternalErrorResponse();
  }
}
