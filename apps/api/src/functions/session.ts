import { withLambda } from "@netlify/aws-lambda-compat";
import { createDeletionJournal } from "../privacy/netlifyDeletionJournal.js";
// Netlify Functions 風格 Handler：(event) => HttpResponse。
// 實際部署設定（netlify.toml functions 目錄）由 Jerry 於 Root Config 處理，
// 本 Task 依 Allowed Paths 限制只提供 /apps/api/** 內的 Handler 實作。
import { createSession, deleteSession } from "../services/sessionService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { enforceRateLimit, hashForRateLimitKey, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { successResponse, internalErrorResponse, errorResponse, nowTaipeiISOString, type HttpResponse } from "../lib/response.js";
import { getClientIp, getSessionTokenHeader } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  blobs?: string;
  headers?: Record<string, string | undefined> | null;
}

// POST /api/v1/session：依 API_CONTRACT §3.1 為公開 endpoint，不需要 X-Kareo-Session-Token。
// DELETE /api/v1/session：依 API_CONTRACT §6 v0.2（TASK-B-011b），需要 X-Kareo-Session-Token。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod === "POST") {
    try {
      // 依 ARCHITECTURE §20.4：建立 session 20 次／小時，鍵為 IP 雜湊（沒有 IP 時退回固定鍵，
      // 只影響非 Netlify 環境下的分組精細度，不影響限流本身是否生效）。
      const ip = getClientIp(event) ?? "unknown";
      await enforceRateLimit(new SupabaseRateLimitRepository(), RATE_LIMIT_RULES.CREATE_SESSION, hashForRateLimitKey(ip), nowTaipeiISOString());

      const repo = new SupabaseSessionRepository();
      const session = await createSession(repo);
      // sessionToken 只在這裡回傳一次，見 ARCHITECTURE §20.1；資料庫只存雜湊。
      return successResponse({
        sessionId: session.id,
        sessionToken: session.sessionToken,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      });
    } catch (err) {
      if (err instanceof AppError) return errorResponse(err);
      return internalErrorResponse();
    }
  }

  if (event.httpMethod === "DELETE") {
    try {
      const repo = new SupabaseSessionRepository();
      const result = await deleteSession(repo, getSessionTokenHeader(event), createDeletionJournal(event));
      return successResponse(result);
    } catch (err) {
      if (err instanceof AppError) return errorResponse(err);
      return internalErrorResponse();
    }
  }

  return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST 或 DELETE /api/v1/session。"));
}

// Modern runtime supplies uncached Blob access for strong-consistency reads.
// Keep the named handler for isolated Lambda-shape module regressions.
export default withLambda(handler);
