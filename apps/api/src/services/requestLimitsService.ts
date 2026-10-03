// TASK-B-011b：ARCHITECTURE §20.4 Payload 限制。共用元件，呼叫端在解析 JSON 前後各自套用。
import { AppError } from "../errors/AppError.js";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FREE_TEXT_LENGTH = 500;

// 依原始字串的 UTF-8 byte 長度檢查（不是字元數），符合「Request body 上限 16 KB」的字面意思。
export function requireBodySize(rawBody: string | null | undefined): void {
  if (!rawBody) return;
  const byteLength = Buffer.byteLength(rawBody, "utf8");
  if (byteLength > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", `請求內容過大（上限 ${MAX_BODY_BYTES / 1024} KB）。`);
  }
}

export function requireFreeTextLength(value: string): void {
  if (value.length > MAX_FREE_TEXT_LENGTH) {
    throw new AppError("VALIDATION_ERROR", `freeText 不得超過 ${MAX_FREE_TEXT_LENGTH} 字。`);
  }
}
