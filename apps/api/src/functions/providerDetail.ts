import { getProviderDetail } from "../services/providerService.js";
import { SupabaseProviderRepository } from "../repositories/supabaseProviderRepository.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  // 實際路由（/api/v1/providers/:providerId -> pathParameters.providerId）由 Root Netlify
  // Config 設定，屬 Jerry 負責範圍；本 Handler 同時接受 pathParameters 與
  // queryStringParameters 兩種來源，方便部署設定與測試。
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
}

// GET /api/v1/providers/{providerId}
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/providers/{providerId}。"));
  }

  const providerId = event.pathParameters?.providerId ?? event.queryStringParameters?.providerId;

  try {
    const provider = await getProviderDetail(new SupabaseProviderRepository(), providerId);
    return successResponse(provider);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
