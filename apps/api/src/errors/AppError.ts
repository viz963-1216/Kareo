// MVP Error Code 固定依 docs/API_CONTRACT.md 第 5 節（MVP 原始集合）與第 3.2 節 v0.2 擴充
// （TASK-B-011a 交付項目之一）。不得自行新增/修改，除依既有 Contract 擴充。
export type ErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONSENT_REQUIRED"
  | "NO_PROVIDER_FOUND"
  | "KNOWLEDGE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  // v0.2（API_CONTRACT §3.2）：
  | "SESSION_INVALID"
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_STATUS_TRANSITION"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"; // 保留碼，MVP 用規則引擎不會實際拋出（docs/API_CONTRACT.md §3.2）

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  VALIDATION_ERROR: 400,
  SESSION_INVALID: 401,
  CONSENT_REQUIRED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NO_PROVIDER_FOUND: 200,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_STATUS_TRANSITION: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  KNOWLEDGE_UNAVAILABLE: 503,
  AI_UNAVAILABLE: 503,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  // cause 只給伺服器端 log / 操作人員看；errorResponse() 只輸出 code 與 message，不會帶出 cause。
  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
  }
}
