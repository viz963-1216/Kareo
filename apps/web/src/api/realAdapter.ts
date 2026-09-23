import type {
  AssessmentRequest,
  AssessmentResponse,
  ConsentRequest,
  ConsentResponse,
  RecommendationRequest,
  RecommendationResponse,
  SessionResponse,
} from "../types/api";

// TASK-J-003 integration wiring: calls the Kareo /api/v1 backend defined in
// docs/API_CONTRACT.md. It never returns mock data; every failure surfaces as ApiError.

const BASE_URL = "/api/v1";
const TIMEOUT_MS = 25_000;
const TOKEN_KEY = "kareo.sessionToken";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FALLBACK_MESSAGES: Record<string, string> = {
  NOT_FOUND: "此功能尚未開放，請稍後再試或直接聯絡 1966。",
  KNOWLEDGE_UNAVAILABLE: "長照制度資料目前正在更新，暫時無法完成評估。請稍後再試或直接聯絡 1966。",
  AI_UNAVAILABLE: "評估服務暫時無法使用，請稍後再試或直接聯絡 1966。",
  RATE_LIMITED: "操作次數過多，請稍候再試。",
  SESSION_INVALID: "您的使用階段已過期，請重新開始。",
  NETWORK: "網路連線不穩定，請確認連線後再試一次。",
  TIMEOUT: "等待回應逾時，請稍後再試或直接聯絡 1966。",
};

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable (private mode); requests will then fail with SESSION_INVALID once enforced.
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = readToken();
  if (token) headers["X-Kareo-Session-Token"] = token;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (reason) {
    const aborted = reason instanceof DOMException && reason.name === "AbortError";
    throw new ApiError(aborted ? "TIMEOUT" : "NETWORK", FALLBACK_MESSAGES[aborted ? "TIMEOUT" : "NETWORK"], 0);
  } finally {
    window.clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("INVALID_RESPONSE", "系統回應異常，請稍後再試或直接聯絡 1966。", response.status);
  }

  const envelope = payload as { success?: boolean; data?: T; error?: { code?: string; message?: string } };
  if (envelope.success === true && envelope.data !== undefined) return envelope.data;

  const code = envelope.error?.code ?? "INVALID_RESPONSE";
  const message = FALLBACK_MESSAGES[code] ?? envelope.error?.message ?? "系統發生錯誤，請稍後再試或直接聯絡 1966。";
  throw new ApiError(code, message, response.status);
}

export const realApi = {
  async createSession(): Promise<SessionResponse> {
    const data = await request<SessionResponse & { sessionToken?: string }>("POST", "/session");
    if (data.sessionToken) storeToken(data.sessionToken);
    return { sessionId: data.sessionId, createdAt: data.createdAt };
  },

  acceptConsent(body: ConsentRequest): Promise<ConsentResponse> {
    return request<ConsentResponse>("POST", "/consent", body);
  },

  submitAssessment(body: AssessmentRequest): Promise<AssessmentResponse> {
    return request<AssessmentResponse>("POST", "/assessments", body);
  },

  getRecommendation(body: RecommendationRequest): Promise<RecommendationResponse> {
    return request<RecommendationResponse>("POST", "/recommendations", body);
  },
};
