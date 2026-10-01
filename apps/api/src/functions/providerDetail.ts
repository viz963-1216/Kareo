import { getProviderDetail } from "../services/providerService.js";
import { SupabaseProviderRepository } from "../repositories/supabaseProviderRepository.js";
import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { enforceRateLimit, hashForRateLimitKey, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { successResponse, internalErrorResponse, errorResponse, nowTaipeiISOString, type HttpResponse } from "../lib/response.js";
import { getClientIp } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  path?: string;
  rawUrl?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  headers?: Record<string, string | undefined> | null;
}

const PROVIDER_PATH = /\/api\/v1\/providers\/([^/?#]+)\/?$/;

function idFromPath(path: string | undefined): string | undefined {
  const match = path?.match(PROVIDER_PATH);
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

// Netlify Functions 沒有 pathParameters。netlify.toml 以 `/api/v1/providers/*` 改寫到本函式、
// 不帶查詢參數（CI 的路由檢查要求如此），所以 providerId 只能從原始請求路徑取得。
// 依序嘗試 event.path、event.rawUrl（改寫時保留原始網址），最後才是 ?providerId=（直接呼叫函式時用）。
export function extractProviderId(event: NetlifyEvent): string | undefined {
  return idFromPath(event.path) ?? idFromRawUrl(event.rawUrl) ?? event.queryStringParameters?.providerId;
}

// GET /api/v1/providers/{providerId}
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/providers/{providerId}。"));
  }

  const providerId = extractProviderId(event);
  if (!providerId) {
    // 跟 getProviderDetail 內部驗證同一個錯誤，提前擋掉可以不必為了明顯缺漏的請求先打一次限流檢查
    // （避免缺 Supabase 設定時這裡先丟 INTERNAL_ERROR，蓋掉原本應該回的 VALIDATION_ERROR）。
    return errorResponse(new AppError("VALIDATION_ERROR", "缺少有效的 providerId。"));
  }

  try {
    // 依 ARCHITECTURE §20.4：Provider detail 60 次／小時，鍵為 IP 雜湊（公開 endpoint，無 session）。
    const ip = getClientIp(event) ?? "unknown";
    await enforceRateLimit(new SupabaseRateLimitRepository(), RATE_LIMIT_RULES.PROVIDER_DETAIL, hashForRateLimitKey(ip), nowTaipeiISOString());

    const provider = await getProviderDetail(new SupabaseProviderRepository(), providerId);
    return successResponse(provider);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
