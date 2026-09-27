// TASK-B-011a：Idempotency-Key 的共用驗證元件。依 docs/API_CONTRACT.md §3.3，
// 目前只提供「格式」驗證；實際的去重比對（同 key 同內容回原結果、不同內容回 IDEMPOTENCY_CONFLICT）
// 需要查詢實際的業務資料表（例如 Lead），屬於 B-006 的職責，這裡不預先假設任何一張表的存在。
import { AppError } from "../errors/AppError.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 缺少或格式錯誤 -> VALIDATION_ERROR（依 API_CONTRACT §3.3）。
export function requireIdempotencyKey(headerValue: unknown): string {
  if (typeof headerValue !== "string" || !UUID_PATTERN.test(headerValue)) {
    throw new AppError("VALIDATION_ERROR", "缺少或格式錯誤的 Idempotency-Key（需為 UUID）。");
  }
  return headerValue;
}
