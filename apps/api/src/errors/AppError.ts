// MVP Error Code 固定依 docs/API_CONTRACT.md 第 5 節，不得自行新增/修改。
export type ErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONSENT_REQUIRED"
  | "NO_PROVIDER_FOUND"
  | "KNOWLEDGE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  VALIDATION_ERROR: 400,
  CONSENT_REQUIRED: 403,
  NOT_FOUND: 404,
  NO_PROVIDER_FOUND: 200,
  KNOWLEDGE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
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

// PRODUCT_SPEC §51 的固定引導文字（無可用知識時）。集中在此，避免規則引擎檔案出現任何政策數值（ASSESSMENT_RULES §10）。
export const KNOWLEDGE_UNAVAILABLE_MESSAGE =
  "目前平台資料不足以做出可靠預估，建議聯絡 1966 或所在地長期照顧管理中心確認。";
