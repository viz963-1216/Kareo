import type {
  AdminKnowledgeChange,
  AdminKnowledgeRecord,
  AdminKnowledgeStatus,
  AdminSessionResponse,
} from "../types/api";

class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const BASE_URL = "/api/v1/admin";
const ADMIN_TOKEN_KEY = "kareo.adminToken";
const ADMIN_TOKEN_HEADER = "X-Kareo-Admin-Token";

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readToken() {
  try {
    return storage()?.getItem(ADMIN_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    storage()?.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    throw new AdminApiError("SESSION_INVALID", "瀏覽器無法安全保存管理工作階段，請確認瀏覽器設定後再試。", 0);
  }
}

function clearToken() {
  try {
    storage()?.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(path: string, options: { method?: "GET" | "POST"; body?: unknown; authenticated?: boolean } = {}) {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.authenticated !== false) {
    const token = readToken();
    if (!token) throw new AdminApiError("SESSION_INVALID", "管理工作階段已失效，請重新登入。", 401);
    headers[ADMIN_TOKEN_HEADER] = token;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new AdminApiError("NETWORK", "網路連線失敗，請稍後再試。", 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", response.status);
  }
  if (!isRecord(payload) || typeof payload.success !== "boolean") {
    throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", response.status);
  }
  if (payload.success === false) {
    const error = isRecord(payload.error) ? payload.error : {};
    const code = typeof error.code === "string" ? error.code : "HTTP_ERROR";
    const message = typeof error.message === "string" ? error.message : "管理操作失敗，請稍後再試。";
    if (code === "SESSION_INVALID" || code === "FORBIDDEN") clearToken();
    throw new AdminApiError(code, message, response.status);
  }
  if (!response.ok || payload.data === undefined || payload.data === null) {
    throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", response.status);
  }
  return payload.data;
}

export const adminRealApi = {
  hasSession: () => Boolean(readToken()),
  logout: clearToken,

  async login(operatorId: string, operatorKey: string): Promise<AdminSessionResponse> {
    const data = await request("/session", {
      method: "POST",
      authenticated: false,
      body: { operatorId, operatorKey },
    });
    if (!isRecord(data) || typeof data.adminToken !== "string" || typeof data.expiresAt !== "string") {
      throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", 200);
    }
    storeToken(data.adminToken);
    return data as unknown as AdminSessionResponse;
  },

  getStatus: () => request("/knowledge/status") as Promise<AdminKnowledgeStatus>,
  async getChanges(): Promise<AdminKnowledgeChange[]> {
    const data = await request("/knowledge/changes?status=NEEDS_REVIEW");
    if (!isRecord(data) || !Array.isArray(data.changes)) throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", 200);
    return data.changes as AdminKnowledgeChange[];
  },
  async getRecords(): Promise<AdminKnowledgeRecord[]> {
    const data = await request("/knowledge/records?status=NEEDS_REVIEW");
    if (!isRecord(data) || !Array.isArray(data.records)) throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", 200);
    return data.records as AdminKnowledgeRecord[];
  },
};
