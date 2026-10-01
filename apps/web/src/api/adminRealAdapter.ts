import type {
  AdminChangeDismissRequest,
  AdminChangeDismissResponse,
  AdminCrawlerRun,
  AdminKnowledgeChange,
  AdminKnowledgeRecord,
  AdminKnowledgeStatus,
  AdminPublishPreview,
  AdminPublishRequest,
  AdminPublishResponse,
  AdminPublishPreviewRecord,
  AdminRecordDecisionRequest,
  AdminRecordDecisionResponse,
  AdminRestorableVersionsResponse,
  AdminRestorableVersion,
  AdminKnowledgeVersionSummary,
  AdminReview,
  AdminSessionResponse,
  AdminWithdrawRequest,
  AdminWithdrawResponse,
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

const crawlerStatuses = ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"] as const;
const changeStatuses = ["NEEDS_REVIEW", "DISMISSED"] as const;
const recordStatuses = ["NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
const jurisdictions = ["TAIWAN", "TAIPEI", "NEW_TAIPEI"] as const;
const reviewDecisions = ["APPROVED", "REJECTED", "DISMISSED"] as const;

function invalidResponse(): never {
  throw new AdminApiError("INVALID_RESPONSE", "管理服務回應格式異常，請稍後再試。", 200);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) invalidResponse();
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return requiredString(value);
}

function requiredDate(value: unknown): string {
  const text = requiredString(value);
  if (!Number.isFinite(Date.parse(text))) invalidResponse();
  return text;
}

function nullableDate(value: unknown): string | null {
  return value === null ? null : requiredDate(value);
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) invalidResponse();
  return value;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) invalidResponse();
  return value as T[number];
}

function parseCrawlerRun(value: unknown): AdminCrawlerRun | null {
  if (value === null) return null;
  if (!isRecord(value)) invalidResponse();
  return {
    status: enumValue(value.status, crawlerStatuses),
    startedAt: requiredDate(value.startedAt),
    finishedAt: nullableDate(value.finishedAt),
  };
}

function parseStatus(value: unknown): AdminKnowledgeStatus {
  if (!isRecord(value)) invalidResponse();
  return {
    publishedVersion: nullableString(value.publishedVersion),
    publishedAt: nullableDate(value.publishedAt),
    lastCrawlerRun: parseCrawlerRun(value.lastCrawlerRun),
  };
}

function parseChange(value: unknown): AdminKnowledgeChange {
  if (!isRecord(value)) invalidResponse();
  return {
    id: requiredString(value.id),
    sourceId: requiredString(value.sourceId),
    detectedAt: requiredString(value.detectedAt),
    previousHash: nullableString(value.previousHash),
    currentHash: requiredString(value.currentHash),
    diffSummary: requiredString(value.diffSummary),
    status: enumValue(value.status, changeStatuses),
  };
}

function parseKnowledgeRecord(value: unknown): AdminKnowledgeRecord {
  if (!isRecord(value)) invalidResponse();
  return {
    id: requiredString(value.id),
    packId: requiredString(value.packId),
    recordId: requiredString(value.recordId),
    title: requiredString(value.title),
    jurisdiction: enumValue(value.jurisdiction, jurisdictions),
    category: requiredString(value.category),
    sourceUrl: requiredString(value.sourceUrl),
    summary: requiredString(value.summary),
    effectiveFrom: nullableDate(value.effectiveFrom),
    effectiveTo: nullableDate(value.effectiveTo),
    contentFingerprint: requiredString(value.contentFingerprint),
    status: enumValue(value.status, recordStatuses),
  };
}

function parseReview(value: unknown): AdminReview {
  if (!isRecord(value)) invalidResponse();
  return {
    decision: enumValue(value.decision, reviewDecisions),
    reason: requiredString(value.reason),
    reviewedBy: requiredString(value.reviewedBy),
    reviewedAt: requiredDate(value.reviewedAt),
  };
}

function parsePreviewRecord(value: unknown): AdminPublishPreviewRecord {
  if (!isRecord(value)) invalidResponse();
  return {
    id: requiredString(value.id),
    packId: requiredString(value.packId),
    recordId: requiredString(value.recordId),
    title: requiredString(value.title),
    jurisdiction: enumValue(value.jurisdiction, jurisdictions),
    effectiveFrom: nullableDate(value.effectiveFrom),
    effectiveTo: nullableDate(value.effectiveTo),
  };
}

function parsePublishCounts(value: Record<string, unknown>) {
  const publishedRecordCount = nonNegativeInteger(value.publishedRecordCount);
  const carriedForwardCount = nonNegativeInteger(value.carriedForwardCount);
  const totalRecordCount = nonNegativeInteger(value.totalRecordCount);
  const supersededRecordCount = nonNegativeInteger(value.supersededRecordCount);
  const excludedRecordCount = nonNegativeInteger(value.excludedRecordCount);
  if (publishedRecordCount + carriedForwardCount !== totalRecordCount) invalidResponse();
  return { publishedRecordCount, carriedForwardCount, totalRecordCount, supersededRecordCount, excludedRecordCount };
}

function parsePublishPreview(value: unknown): AdminPublishPreview {
  if (!isRecord(value) || typeof value.canPublish !== "boolean" || !Array.isArray(value.newRecords) || !Array.isArray(value.blockers)) invalidResponse();
  const targetVersionId = nullableString(value.targetVersionId);
  const previewToken = nullableString(value.previewToken);
  if (value.canPublish && (!targetVersionId || !previewToken)) invalidResponse();
  const blockers = value.blockers.map((blocker) => {
    if (!isRecord(blocker)) invalidResponse();
    return { code: requiredString(blocker.code), message: requiredString(blocker.message) };
  });
  return {
    canPublish: value.canPublish,
    targetVersionId,
    currentVersionId: nullableString(value.currentVersionId),
    publishDate: requiredDate(value.publishDate),
    ...parsePublishCounts(value),
    newRecords: value.newRecords.map(parsePreviewRecord),
    blockers,
    previewToken,
    generatedAt: requiredDate(value.generatedAt),
  };
}

function parseVersionSummary(value: unknown): AdminKnowledgeVersionSummary {
  if (!isRecord(value)) invalidResponse();
  return { versionId: requiredString(value.versionId), publishedAt: requiredDate(value.publishedAt), recordCount: nonNegativeInteger(value.recordCount) };
}

function parseRestorableVersion(value: unknown): AdminRestorableVersion {
  if (!isRecord(value)) invalidResponse();
  return { ...parseVersionSummary(value), approvedBy: requiredString(value.approvedBy), notes: nullableString(value.notes) };
}

function parseRestorableVersions(value: unknown): AdminRestorableVersionsResponse {
  if (!isRecord(value) || !Array.isArray(value.versions)) invalidResponse();
  return {
    currentVersion: value.currentVersion === null ? null : parseVersionSummary(value.currentVersion),
    versions: value.versions.map(parseRestorableVersion),
  };
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

  async getStatus(): Promise<AdminKnowledgeStatus> {
    return parseStatus(await request("/knowledge/status"));
  },
  async getChanges(): Promise<AdminKnowledgeChange[]> {
    const data = await request("/knowledge/changes?status=NEEDS_REVIEW");
    if (!isRecord(data) || !Array.isArray(data.changes)) invalidResponse();
    return data.changes.map(parseChange);
  },
  async getRecords(): Promise<AdminKnowledgeRecord[]> {
    const data = await request("/knowledge/records?status=NEEDS_REVIEW");
    if (!isRecord(data) || !Array.isArray(data.records)) invalidResponse();
    return data.records.map(parseKnowledgeRecord);
  },
  async decideRecord(recordId: string, body: AdminRecordDecisionRequest): Promise<AdminRecordDecisionResponse> {
    const data = await request(`/knowledge/records/${encodeURIComponent(recordId)}/decision`, { method: "POST", body });
    if (!isRecord(data)) invalidResponse();
    const record = parseKnowledgeRecord(data.record);
    const review = parseReview(data.review);
    if (record.id !== recordId || record.status !== body.decision || review.decision !== body.decision) invalidResponse();
    return { record, review };
  },
  async dismissChange(changeId: string, body: AdminChangeDismissRequest): Promise<AdminChangeDismissResponse> {
    const data = await request(`/knowledge/changes/${encodeURIComponent(changeId)}/dismiss`, { method: "POST", body });
    if (!isRecord(data)) invalidResponse();
    const change = parseChange(data.change);
    const review = parseReview(data.review);
    if (change.id !== changeId || change.status !== "DISMISSED" || review.decision !== "DISMISSED") invalidResponse();
    return { change, review };
  },
  async getPublishPreview(): Promise<AdminPublishPreview> {
    return parsePublishPreview(await request("/knowledge/publish-preview"));
  },
  async publish(body: AdminPublishRequest): Promise<AdminPublishResponse> {
    const data = await request("/knowledge/publish", { method: "POST", body });
    if (!isRecord(data)) invalidResponse();
    const result = { versionId: requiredString(data.versionId), publishedAt: requiredDate(data.publishedAt), ...parsePublishCounts(data) };
    if (result.versionId !== body.versionId) invalidResponse();
    return result;
  },
  async getRestorableVersions(): Promise<AdminRestorableVersionsResponse> {
    return parseRestorableVersions(await request("/knowledge/restorable-versions"));
  },
  async withdraw(body: AdminWithdrawRequest): Promise<AdminWithdrawResponse> {
    const data = await request("/knowledge/withdraw", { method: "POST", body });
    if (!isRecord(data)) invalidResponse();
    const result = {
      withdrawnVersionId: requiredString(data.withdrawnVersionId),
      republishedVersionId: nullableString(data.republishedVersionId),
      withdrawnAt: requiredDate(data.withdrawnAt),
      withdrawnBy: requiredString(data.withdrawnBy),
      reason: requiredString(data.reason),
    };
    if (result.withdrawnVersionId !== body.withdrawVersionId || result.republishedVersionId !== body.republishVersionId) invalidResponse();
    return result;
  },
};
