// Netlify Functions 風格 Handler：(event) => HttpResponse。
// 實際部署設定（netlify.toml functions 目錄）由 Jerry 於 Root Config 處理，
// 本 Task 依 Allowed Paths 限制只提供 /apps/api/** 內的 Handler 實作。
import { createSession } from "../services/sessionService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
}

// POST /api/v1/session：依 API_CONTRACT §3.1 為公開 endpoint，不需要 X-Kareo-Session-Token。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/session。"));
  }

  try {
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
