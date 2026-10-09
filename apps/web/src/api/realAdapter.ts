import { isProviderPublicInfo } from "../../../api/src/services/providerPublicInfo.ts";
import type {
  AssessmentRequest,
  AssessmentResponse,
  CareNeed,
  ConsentRequest,
  ConsentResponse,
  ConsentWithdrawalResponse,
  LeadRequest,
  LeadResponse,
  KnowledgeRecordsRequest,
  KnowledgeRecordsResponse,
  KnowledgeCategory,
  KnowledgeJurisdiction,
  ProviderDetail,
  ProviderContractRegion,
  ResourceLookupAppliedFilters,
  ResourceLookupItem,
  ResourceLookupRequest,
  ResourceLookupResponse,
  RankingType,
  RecommendationRequest,
  RecommendationResponse,
  SessionDeletionResponse,
  SessionResponse,
} from "../types/api";

// TASK-J-003 integration wiring: calls the Kareo /api/v1 backend defined in
// docs/API_CONTRACT.md. It never returns mock data; every failure surfaces as ApiError.
// Uses globalThis (not window) so the same module runs under the Node test runner (tests/web).

const BASE_URL = "/api/v1";
const DEFAULT_TIMEOUT_MS = 25_000;
const TOKEN_KEY = "kareo.sessionToken";
const TOKEN_HEADER = "X-Kareo-Session-Token";

// API_CONTRACT §3.1: endpoints that never need a session token.
const PUBLIC_ENDPOINTS: Array<[method: string, path: RegExp]> = [
  ["POST", /^\/session$/],
  ["GET", /^\/providers\/[^/]+$/],
  ["GET", /^\/providers(?:\?.*)?$/],
  ["GET", /^\/external-services\/transportation$/],
  ["GET", /^\/knowledge\/status$/],
  ["GET", /^\/knowledge\/records(?:\?.*)?$/],
];

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const GENERIC_MESSAGE = "系統發生錯誤，請稍後再試或直接聯絡 1966。";

const FALLBACK_MESSAGES: Record<string, string> = {
  NOT_FOUND: "此功能尚未開放，請稍後再試或直接聯絡 1966。",
  KNOWLEDGE_UNAVAILABLE: "長照制度資料目前正在更新，暫時無法完成評估。請稍後再試或直接聯絡 1966。",
  AI_UNAVAILABLE: "評估服務暫時無法使用，請稍後再試或直接聯絡 1966。",
  RATE_LIMITED: "操作次數過多，請稍候再試。",
  SESSION_INVALID: "您的使用階段已過期，請重新開始。",
  SESSION_TOKEN_MISSING: "系統未能建立安全的使用階段，請稍後再試或直接聯絡 1966。",
  FORBIDDEN: "這個使用階段無法存取此資料，請重新開始。",
  CONSENT_REQUIRED: "需要先同意服務說明後才能繼續，請重新開始。",
  NETWORK: "網路連線不穩定，請確認連線後再試一次。",
  TIMEOUT: "等待回應逾時，請稍後再試或直接聯絡 1966。",
  INVALID_RESPONSE: "系統回應異常，請稍後再試或直接聯絡 1966。",
  HTTP_ERROR: GENERIC_MESSAGE,
  INTERNAL_ERROR: GENERIC_MESSAGE,
  INVALID_REQUEST: "請確認輸入資料後再試一次。",
  VALIDATION_ERROR: "請確認輸入資料與同意版本後再試一次。",
  NO_PROVIDER_FOUND: "目前沒有符合條件的服務單位，請調整條件或聯絡 1966。",
  PAYLOAD_TOO_LARGE: "送出的資料過多，請縮短內容後再試一次。",
  IDEMPOTENCY_CONFLICT: "這次重試的內容與先前送出不同，請重新確認後再送出。",
  INVALID_STATUS_TRANSITION: "資料狀態已改變，請重新載入後再試一次。",
};

// Whether a missing session token is fatal. API_CONTRACT v0.2 §3.1 requires tokens, but that
// section is PROPOSED (MVP_DECISIONS D-04) and the backend does not issue tokens yet (B-011a).
// index.ts sets this from VITE_KAREO_REQUIRE_SESSION_TOKEN; production builds require it (build-site.mjs).
let requireSessionToken = false;
let timeoutMs = DEFAULT_TIMEOUT_MS;
let sessionAuth: "UNKNOWN" | "TOKEN" | "NONE" = "UNKNOWN";

export function configureRealApi(options: { requireSessionToken: boolean; timeoutMs?: number }) {
  requireSessionToken = options.requireSessionToken;
  timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

/** "NONE" means the backend issued no token: requests are not session-protected. */
export function getSessionAuth() {
  return sessionAuth;
}

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  try {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    storage()?.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable (private mode); requests will then fail with SESSION_INVALID once enforced.
  }
}

function clearToken() {
  try {
    storage()?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}

function isPublic(method: string, path: string) {
  return PUBLIC_ENDPOINTS.some(([m, pattern]) => m === method && pattern.test(path));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// C-005: shape checks for success payloads (API_CONTRACT v0.2.2). A 200 response that does not match the
// contract must never be rendered as a successful assessment, recommendation or lead.
const CARE_NEEDS: readonly CareNeed[] = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE", "TRANSPORTATION"];
const RECOMMENDATION_SERVICES = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"];
const RANKING_TYPES: readonly RankingType[] = ["DISTANCE", "DISTRICT_ROTATION", "CITY_ROTATION", "NO_LOCATION"];
const PRECISIONS = ["NONE", "CITY", "DISTRICT", "EXACT", "GPS"];
const LEAD_STATUSES = ["NEW", "CONTACTED", "ACCEPTED", "CLOSED", "CANCELLED"];
const RESOURCE_CATEGORIES = ["SERVICE_PROVIDER", "ASSISTIVE_DEVICE_CENTER"];
const SERVICE_AREA_STATUSES = ["VERIFIED", "UNCONFIRMED"];
const RESOURCE_AREA_FILTERS = ["LOCATED_IN", "SERVICE_AREA"];
const RESOURCE_AREA_MATCHES = ["VERIFIED", "UNCONFIRMED"];
const LOOKUP_CITIES = ["臺北市", "新北市"];
const KNOWLEDGE_JURISDICTIONS: readonly KnowledgeJurisdiction[] = ["TAIWAN", "TAIPEI", "NEW_TAIPEI"];
const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  "ELIGIBILITY", "BENEFIT", "COPAY", "TRANSPORTATION", "HOME_MEDICAL_NURSING",
  "APPLICATION", "ASSISTIVE_DEVICE", "RESPITE", "HOME_CARE", "OTHER",
];

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isCareNeedArray = (value: unknown) => Array.isArray(value) && value.every((item) => CARE_NEEDS.includes(item as CareNeed));

export function isAssessmentResponse(value: unknown): value is AssessmentResponse {
  if (!isRecord(value) || !isText(value.assessmentId) || !isText(value.knowledgeVersion)) return false;
  const profile = value.careNeedProfile;
  return isRecord(profile)
    && isText(profile.id)
    && isCareNeedArray(profile.careNeeds)
    && isCareNeedArray(profile.priority)
    && isText(profile.summary)
    // API_CONTRACT §15: every assessment carries the preliminary-result warnings.
    && isStringArray(profile.warnings)
    && profile.warnings.length > 0;
}

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
};

export function isKnowledgeRecordsResponse(value: unknown): value is KnowledgeRecordsResponse {
  if (!isRecord(value) || !exactKeys(value, ["knowledgeVersion", "publishedAt", "items", "page", "pageSize", "totalCount", "appliedFilters", "notice"])) return false;
  if (!isText(value.knowledgeVersion) || !isText(value.publishedAt) || !isText(value.notice)) return false;
  if (!Number.isInteger(value.page) || (value.page as number) < 1 || !Number.isInteger(value.pageSize) || (value.pageSize as number) < 1 || !Number.isInteger(value.totalCount) || (value.totalCount as number) < 0) return false;
  if (!isRecord(value.appliedFilters) || !exactKeys(value.appliedFilters, ["jurisdiction", "category", "page", "pageSize"])) return false;
  const filters = value.appliedFilters;
  if (filters.jurisdiction !== null && !KNOWLEDGE_JURISDICTIONS.includes(filters.jurisdiction as KnowledgeJurisdiction)) return false;
  if (filters.category !== null && !KNOWLEDGE_CATEGORIES.includes(filters.category as KnowledgeCategory)) return false;
  if (!Number.isInteger(filters.page) || !Number.isInteger(filters.pageSize) || filters.page !== value.page || filters.pageSize !== value.pageSize) return false;
  if (!Array.isArray(value.items)) return false;
  return value.items.every((item) => {
    if (!isRecord(item) || !exactKeys(item, ["id", "title", "category", "jurisdiction", "summary", "effectiveFrom", "effectiveTo", "publishedAt", "lastVerifiedAt", "source"])) return false;
    if (!isText(item.id) || !isText(item.title) || !isText(item.summary) || !isText(item.effectiveFrom) || !isText(item.lastVerifiedAt)) return false;
    if (!KNOWLEDGE_CATEGORIES.includes(item.category as KnowledgeCategory) || !KNOWLEDGE_JURISDICTIONS.includes(item.jurisdiction as KnowledgeJurisdiction)) return false;
    if (item.effectiveTo !== null && !isText(item.effectiveTo)) return false;
    if (item.publishedAt !== null && !isText(item.publishedAt)) return false;
    if (!isRecord(item.source) || !exactKeys(item.source, ["title", "publisher", "url"])) return false;
    return isText(item.source.title) && isText(item.source.publisher) && (item.source.url === null || isText(item.source.url));
  });
}

export function knowledgeRecordsPath(filters: KnowledgeRecordsRequest) {
  const query = new URLSearchParams();
  if (filters.jurisdiction) query.set("jurisdiction", filters.jurisdiction);
  if (filters.category) query.set("category", filters.category);
  query.set("page", String(filters.page));
  query.set("pageSize", String(filters.pageSize));
  return `/knowledge/records?${query.toString()}`;
}

export function isRecommendationResponse(value: unknown): value is RecommendationResponse {
  if (!isRecord(value)) return false;
  if (!isText(value.recommendationId) || !RECOMMENDATION_SERVICES.includes(value.serviceType as string)) return false;
  if (!RANKING_TYPES.includes(value.rankingType as RankingType) || !PRECISIONS.includes(value.locationPrecision as string)) return false;
  if (typeof value.notice !== "string" || !Array.isArray(value.providers)) return false;
  return value.providers.every((provider) => isRecord(provider)
    && isText(provider.id)
    && isText(provider.name)
    && typeof provider.address === "string"
    && typeof provider.district === "string"
    && typeof provider.phone === "string"
    && typeof provider.googleMapsUrl === "string"
    && typeof provider.verified === "boolean"
    && (provider.distanceKm === null || typeof provider.distanceKm === "number")
    && isStringArray(provider.reasons));
}

export function isLeadResponse(value: unknown): value is LeadResponse {
  return isRecord(value)
    && isText(value.leadId)
    && LEAD_STATUSES.includes(value.status as string)
    && typeof value.createdAt === "string"
    && typeof value.duplicate === "boolean";
}

export function isSessionDeletionResponse(value: unknown): value is SessionDeletionResponse {
  return isRecord(value)
    && isText(value.sessionId)
    && value.status === "DELETION_REQUESTED"
    && typeof value.deletionScheduledBefore === "string";
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isContractRegion(value: unknown): value is ProviderContractRegion {
  return isRecord(value)
    && Object.keys(value).length === 2
    && "city" in value
    && "serviceType" in value
    && LOOKUP_CITIES.includes(value.city as string)
    && RECOMMENDATION_SERVICES.includes(value.serviceType as string);
}

function isProviderSharedFields(value: Record<string, unknown>) {
  return isText(value.id)
    && isText(value.name)
    && [...RECOMMENDATION_SERVICES, "OTHER"].includes(value.type as string)
    && RESOURCE_CATEGORIES.includes(value.resourceCategory as string)
    && isStringArray(value.services)
    && value.services.every((service) => RECOMMENDATION_SERVICES.includes(service))
    && typeof value.address === "string"
    && typeof value.city === "string"
    && typeof value.district === "string"
    && typeof value.phone === "string"
    && isNullableText(value.website)
    && typeof value.googleMapsUrl === "string"
    && typeof value.verified === "boolean"
    && SERVICE_AREA_STATUSES.includes(value.serviceAreaStatus as string)
    && Array.isArray(value.contractRegions)
    && value.contractRegions.every(isContractRegion);
}

export function isProviderDetail(value: unknown): value is ProviderDetail {
  if (!isRecord(value) || !isProviderSharedFields(value) || !Array.isArray(value.serviceAreas)) return false;
  if ("publicInfo" in value && !isProviderPublicInfo(value.publicInfo)) return false;
  const detailKeys = ["id", "name", "type", "resourceCategory", "address", "city", "district", "phone", "website", "googleMapsUrl", "verified", "services", "serviceAreas", "serviceAreaStatus", "contractRegions"];
  if (Object.keys(value).length !== detailKeys.length + ("publicInfo" in value ? 1 : 0) || !detailKeys.every((key) => key in value)) return false;
  if (!value.serviceAreas.every((area) => isRecord(area)
    && Object.keys(area).length === 2
    && "city" in area
    && "district" in area
    && typeof area.city === "string"
    && typeof area.district === "string")) return false;
  if ((value.serviceAreaStatus === "VERIFIED") !== (value.serviceAreas.length > 0)) return false;
  if (!isStringArray(value.services)) return false;
  if (value.resourceCategory === "ASSISTIVE_DEVICE_CENTER") {
    return value.type === "OTHER" && value.services.length === 0;
  }
  return value.services.length > 0;
}

function isResourceLookupItem(value: unknown): value is ResourceLookupItem {
  if (!isRecord(value) || !isProviderSharedFields(value)) return false;
  if ("publicInfo" in value && !isProviderPublicInfo(value.publicInfo)) return false;
  const itemKeys = ["id", "name", "type", "resourceCategory", "services", "address", "city", "district", "phone", "website", "googleMapsUrl", "verified", "serviceAreaStatus", "contractRegions", "areaMatch"];
  return Object.keys(value).length === itemKeys.length + ("publicInfo" in value ? 1 : 0)
    && itemKeys.every((key) => key in value)
    && (value.areaMatch === null || RESOURCE_AREA_MATCHES.includes(value.areaMatch as string));
}

function isAppliedFilters(value: unknown): value is ResourceLookupAppliedFilters {
  if (!isRecord(value)) return false;
  if ("assistiveProgram" in value && !["PURCHASE", "SMART_TECH"].includes(value.assistiveProgram as string)) return false;
  const expectedKeys = ["resourceCategory", "serviceType", "city", "district", "areaFilter", "includeUnconfirmed", "contractCity", "q", "page", "pageSize"];
  if (Object.keys(value).length !== expectedKeys.length + ("assistiveProgram" in value ? 1 : 0) || !expectedKeys.every((key) => key in value)) return false;
  return (value.resourceCategory === null || RESOURCE_CATEGORIES.includes(value.resourceCategory as string))
    && (value.serviceType === null || RECOMMENDATION_SERVICES.includes(value.serviceType as string))
    && (value.city === null || LOOKUP_CITIES.includes(value.city as string))
    && isNullableText(value.district)
    && (value.areaFilter === null || RESOURCE_AREA_FILTERS.includes(value.areaFilter as string))
    && typeof value.includeUnconfirmed === "boolean"
    && (value.contractCity === null || LOOKUP_CITIES.includes(value.contractCity as string))
    && isNullableText(value.q)
    && isPositiveInteger(value.page)
    && isPositiveInteger(value.pageSize)
    && value.pageSize <= 50;
}

export function isResourceLookupResponse(value: unknown): value is ResourceLookupResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isResourceLookupItem)) return false;
  const responseKeys = ["items", "page", "pageSize", "totalCount", "unconfirmedCount", "appliedFilters", "notice"];
  return Object.keys(value).length === responseKeys.length
    && responseKeys.every((key) => key in value)
    && isPositiveInteger(value.page)
    && isPositiveInteger(value.pageSize)
    && value.pageSize <= 50
    && isNonNegativeInteger(value.totalCount)
    && (value.unconfirmedCount === null || isNonNegativeInteger(value.unconfirmedCount))
    && isAppliedFilters(value.appliedFilters)
    && typeof value.notice === "string";
}

export function resourceLookupPath(filters: ResourceLookupRequest) {
  const query = new URLSearchParams();
  if (filters.assistiveProgram) query.set("assistiveProgram", filters.assistiveProgram);
  if (filters.resourceCategory) query.set("resourceCategory", filters.resourceCategory);
  if (filters.serviceType) query.set("serviceType", filters.serviceType);
  if (filters.city) query.set("city", filters.city);
  if (filters.district) query.set("district", filters.district);
  if (filters.areaFilter) query.set("areaFilter", filters.areaFilter);
  if (filters.includeUnconfirmed !== undefined) query.set("includeUnconfirmed", String(filters.includeUnconfirmed));
  if (filters.contractCity) query.set("contractCity", filters.contractCity);
  if (filters.q) query.set("q", filters.q);
  if (filters.page !== undefined) query.set("page", String(filters.page));
  if (filters.pageSize !== undefined) query.set("pageSize", String(filters.pageSize));
  const suffix = query.toString();
  return suffix ? `/providers?${suffix}` : "/providers";
}

function invalidResponse(): never {
  throw new ApiError("INVALID_RESPONSE", FALLBACK_MESSAGES.INVALID_RESPONSE, 200);
}

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!isPublic(method, path)) {
    const token = readToken();
    if (token) headers[TOKEN_HEADER] = token;
    else if (requireSessionToken) throw new ApiError("SESSION_INVALID", FALLBACK_MESSAGES.SESSION_INVALID, 0);
  }

  // The timeout covers the whole exchange, including reading the body, not just the headers.
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    text = await response.text();
  } catch {
    const code = controller.signal.aborted ? "TIMEOUT" : "NETWORK";
    throw new ApiError(code, FALLBACK_MESSAGES[code], 0);
  } finally {
    globalThis.clearTimeout(timer);
  }

  let payload: unknown = null;
  if (text.trim() !== "") {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  // Anything that is not a {success: boolean} envelope (HTML error page, null, empty body) is an error.
  if (!isRecord(payload) || typeof payload.success !== "boolean") {
    const code = response.ok ? "INVALID_RESPONSE" : "HTTP_ERROR";
    throw new ApiError(code, FALLBACK_MESSAGES[code], response.status);
  }

  if (payload.success === true) {
    // A success envelope on a non-2xx status, or without data, is inconsistent and never trusted.
    if (!response.ok || payload.data === undefined || payload.data === null) {
      throw new ApiError("INVALID_RESPONSE", FALLBACK_MESSAGES.INVALID_RESPONSE, response.status);
    }
    return payload.data as T;
  }

  const error = isRecord(payload.error) ? payload.error : {};
  const code = typeof error.code === "string" && error.code ? error.code : response.ok ? "INVALID_RESPONSE" : "HTTP_ERROR";
  if (code === "SESSION_INVALID") clearToken();
  // ARCHITECTURE §20.6: server diagnostics must never become public UI text.
  // Keep code/status for callers, but use only locally reviewed messages.
  // Own-property lookup also prevents an unexpected code such as "constructor"
  // from reading Object.prototype instead of the safe fallback.
  const message = Object.prototype.hasOwnProperty.call(FALLBACK_MESSAGES, code) ? FALLBACK_MESSAGES[code] : GENERIC_MESSAGE;
  throw new ApiError(code, message, response.status);
}

export const realApi = {
  async createSession(): Promise<SessionResponse> {
    // A new session must never reuse the previous session's credential, even if creation fails.
    clearToken();
    sessionAuth = "UNKNOWN";
    const data = await request<Partial<SessionResponse> & { sessionToken?: unknown }>("POST", "/session");
    if (typeof data.sessionId !== "string" || !data.sessionId || typeof data.createdAt !== "string") {
      throw new ApiError("INVALID_RESPONSE", FALLBACK_MESSAGES.INVALID_RESPONSE, 200);
    }
    if (typeof data.sessionToken === "string" && data.sessionToken) {
      storeToken(data.sessionToken);
      sessionAuth = "TOKEN";
    } else if (requireSessionToken) {
      throw new ApiError("SESSION_TOKEN_MISSING", FALLBACK_MESSAGES.SESSION_TOKEN_MISSING, 200);
    } else {
      sessionAuth = "NONE";
      console.warn("Kareo API: backend issued no session token; requests are not session-protected (B-011a pending).");
    }
    return { sessionId: data.sessionId, createdAt: data.createdAt };
  },

  acceptConsent(body: ConsentRequest): Promise<ConsentResponse> {
    return request<ConsentResponse>("POST", "/consent", body);
  },

  async submitAssessment(body: AssessmentRequest): Promise<AssessmentResponse> {
    const data = await request<unknown>("POST", "/assessments", body);
    return isAssessmentResponse(data) ? data : invalidResponse();
  },

  async getRecommendation(body: RecommendationRequest): Promise<RecommendationResponse> {
    const data = await request<unknown>("POST", "/recommendations", body);
    return isRecommendationResponse(data) ? data : invalidResponse();
  },

  /** API_CONTRACT §12 + §3.3. The caller supplies the Idempotency-Key (see ./leadIdempotency.ts). */
  async createLead(body: LeadRequest, idempotencyKey: string): Promise<LeadResponse> {
    const data = await request<unknown>("POST", "/leads", body, { "Idempotency-Key": idempotencyKey });
    return isLeadResponse(data) ? data : invalidResponse();
  },

  /** API_CONTRACT §6 DELETE /session. The token is dropped locally only after the server confirms. */
  async deleteSession(): Promise<SessionDeletionResponse> {
    const data = await request<unknown>("DELETE", "/session");
    if (!isSessionDeletionResponse(data)) invalidResponse();
    clearToken();
    sessionAuth = "UNKNOWN";
    return data;
  },

  /** API_CONTRACT §7 POST /consent/withdraw: the session enters deletion and its token stops working. */
  async withdrawConsent(): Promise<ConsentWithdrawalResponse> {
    const data = await request<unknown>("POST", "/consent/withdraw");
    if (!isRecord(data) || typeof data.withdrawnAt !== "string" || data.sessionStatus !== "DELETION_REQUESTED") invalidResponse();
    clearToken();
    sessionAuth = "UNKNOWN";
    return data as unknown as ConsentWithdrawalResponse;
  },

  /** Forgets this tab's session credential. It does not delete anything on the server. */
  forgetLocalSession() {
    clearToken();
    sessionAuth = "UNKNOWN";
  },

  async getProvider(providerId: string): Promise<ProviderDetail | null> {
    try {
      const data = await request<unknown>("GET", `/providers/${encodeURIComponent(providerId)}`);
      return isProviderDetail(data) ? data : invalidResponse();
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "NOT_FOUND") return null;
      throw reason;
    }
  },

  async getProviders(filters: ResourceLookupRequest): Promise<ResourceLookupResponse> {
    const data = await request<unknown>("GET", resourceLookupPath(filters));
    return isResourceLookupResponse(data) ? data : invalidResponse();
  },

  async getKnowledgeRecords(filters: KnowledgeRecordsRequest): Promise<KnowledgeRecordsResponse> {
    const data = await request<unknown>("GET", knowledgeRecordsPath(filters));
    return isKnowledgeRecordsResponse(data) ? data : invalidResponse();
  },
};
