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

export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/session。"));
  }

  try {
    const repo = new SupabaseSessionRepository();
    const session = await createSession(repo);
    return successResponse({ sessionId: session.id, createdAt: session.createdAt });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
