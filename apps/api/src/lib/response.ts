import { AppError } from "../errors/AppError.js";

// 統一成功 / 錯誤格式，依 docs/API_CONTRACT.md 第 4-5 節，不得自行改變結構。
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function successResponse<T>(data: T, statusCode = 200): HttpResponse {
  const body: ApiSuccess<T> = { success: true, data };
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export function errorResponse(err: AppError): HttpResponse {
  const body: ApiError = {
    success: false,
    error: { code: err.code, message: err.message },
  };
  return { statusCode: err.statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

// 未預期例外統一包裝為 INTERNAL_ERROR，不得洩漏原始錯誤內容（可能含 Secret / Stack）給前端。
export function internalErrorResponse(): HttpResponse {
  return errorResponse(new AppError("INTERNAL_ERROR", "系統發生錯誤，請稍後再試。"));
}

// 所有時間使用 ISO 8601，含 Asia/Taipei (+08:00) 偏移，依 docs/DATA_MODEL.md 第 31 節。
export function nowTaipeiISOString(): string {
  const now = new Date();
  const taipeiMs = now.getTime() + 8 * 60 * 60 * 1000;
  const taipei = new Date(taipeiMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = taipei.getUTCFullYear();
  const mm = pad(taipei.getUTCMonth() + 1);
  const dd = pad(taipei.getUTCDate());
  const hh = pad(taipei.getUTCHours());
  const mi = pad(taipei.getUTCMinutes());
  const ss = pad(taipei.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;
}

// Debug / Demo ID Prefix，依 docs/DATA_MODEL.md 第 32 節。正式 DB 可改用 UUID。
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}-${timePart}${random}`.toUpperCase();
}
