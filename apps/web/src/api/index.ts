import type {
  AssessmentRequest,
  AssessmentResponse,
  ConsentRequest,
  ConsentWithdrawalResponse,
  LeadRequest,
  LeadResponse,
  ProviderDetail,
  RecommendationRequest,
  RecommendationResponse,
  SessionDeletionResponse,
} from "../types/api";
import { createLeadIdempotency } from "./leadIdempotency";
import type { RecommendationMockOptions } from "./mockAdapter";
import type { MockState } from "./mockScenarios";
import { resolveApiMode, type ApiMode } from "./mode";
import { ApiError, configureRealApi, realApi } from "./realAdapter";

// TASK-J-003 integration switch. Mock is only for local development and deploy previews (see ./mode.ts);
// every other build uses the real API even if VITE_KAREO_API_MODE=mock was set by mistake.
//
// MOCK_BUILD is replaced by a literal at build time. When it is false, every mock branch below is dead
// code and the mock adapter and its fixtures are not bundled (CI checks the real bundle for mock IDs).
const MOCK_BUILD = import.meta.env.DEV || import.meta.env.VITE_KAREO_API_MODE === "mock";

const resolvedMode = resolveApiMode({
  requested: import.meta.env.VITE_KAREO_API_MODE,
  dev: import.meta.env.DEV,
  deployContext: import.meta.env.VITE_KAREO_DEPLOY_CONTEXT,
});
if (resolvedMode.problem) console.error(`Kareo API: ${resolvedMode.problem}`);
export const apiMode: ApiMode = MOCK_BUILD && resolvedMode.mode === "mock" ? "mock" : "real";

configureRealApi({ requireSessionToken: import.meta.env.VITE_KAREO_REQUIRE_SESSION_TOKEN === "true" });

const loadMock = () => import("./mockAdapter").then((module) => module.mockApi);

type ConsentVersions = Pick<ConsentRequest, "disclaimerVersion" | "privacyVersion" | "termsVersion">;

// Real mode only submits consent versions supplied by the deployment (Jerry-approved versions,
// docs/PRIVACY_AND_RETENTION.md §3.2). Without them consent is refused instead of recording a placeholder.
function realConsentVersions(): ConsentVersions | null {
  const disclaimerVersion = import.meta.env.VITE_CONSENT_DISCLAIMER_VERSION;
  const privacyVersion = import.meta.env.VITE_CONSENT_PRIVACY_VERSION;
  const termsVersion = import.meta.env.VITE_CONSENT_TERMS_VERSION;
  if (!disclaimerVersion || !privacyVersion || !termsVersion) return null;
  return { disclaimerVersion, privacyVersion, termsVersion };
}

export const consentVersions: ConsentVersions | null =
  apiMode === "mock"
    ? { disclaimerVersion: "MOCK-1.0", privacyVersion: "MOCK-1.0", termsVersion: "MOCK-1.0" }
    : realConsentVersions();

// Consent copy is DRAFT until Jerry and legal approve an ACTIVE version (PRIVACY_AND_RETENTION §3.2, D-05).
export const consentIsDraft = !consentVersions || apiMode === "mock"
  || [consentVersions.disclaimerVersion, consentVersions.privacyVersion, consentVersions.termsVersion].some((v) => v.endsWith("-draft"));

// D-13g: 「使用目前位置」 stays hidden in real deployments until the consent version covering location is
// ACTIVE and J-003 turns on VITE_KAREO_ENABLE_PRECISE_LOCATION. Mock mode shows it for acceptance.
export const preciseLocationEnabled = apiMode === "mock" || import.meta.env.VITE_KAREO_ENABLE_PRECISE_LOCATION === "true";

const SESSION_PROBLEM_CODES = ["SESSION_INVALID", "SESSION_TOKEN_MISSING", "FORBIDDEN", "CONSENT_REQUIRED"];

/** Errors that cannot be fixed by retrying: the user must start a new session. */
export function isSessionProblem(error: unknown) {
  return error instanceof ApiError && SESSION_PROBLEM_CODES.includes(error.code);
}

export { ApiError };

const leadIdempotency = createLeadIdempotency();

export const api = {
  createSession() {
    return apiMode === "mock" ? loadMock().then((mock) => mock.createSession()) : realApi.createSession();
  },

  async acceptConsent(sessionId: string) {
    if (!consentVersions) {
      throw new ApiError("CONSENT_VERSION_UNAVAILABLE", "服務說明文件尚在確認中，暫時無法開始評估。請直接聯絡 1966。", 0);
    }
    const body: ConsentRequest = { sessionId, ...consentVersions, accepted: true };
    return apiMode === "mock" ? loadMock().then((mock) => mock.acceptConsent(body)) : realApi.acceptConsent(body);
  },

  submitAssessment(request: AssessmentRequest, mockState?: MockState): Promise<AssessmentResponse> {
    return apiMode === "mock" ? loadMock().then((mock) => mock.submitAssessment(request, mockState)) : realApi.submitAssessment(request);
  },

  /** Idempotency-Key handling lives here so every UI path gets the same retry behavior (API_CONTRACT §3.3). */
  async createLead(request: LeadRequest, mockState?: MockState): Promise<LeadResponse> {
    const key = leadIdempotency.keyFor(request);
    const response = apiMode === "mock"
      ? await loadMock().then((mock) => mock.createLead(request, key, mockState))
      : await realApi.createLead(request, key);
    leadIdempotency.settle();
    return response;
  },

  /** Asks the backend to delete this session's data (API_CONTRACT §6, PRIVACY_AND_RETENTION §6.1). */
  deleteSession(mockState?: MockState): Promise<SessionDeletionResponse> {
    return apiMode === "mock" ? loadMock().then((mock) => mock.deleteSession(mockState)) : realApi.deleteSession();
  },

  /** Withdraws consent (API_CONTRACT §7, PRIVACY_AND_RETENTION §3.3); the session then enters deletion. */
  withdrawConsent(mockState?: MockState): Promise<ConsentWithdrawalResponse> {
    return apiMode === "mock" ? loadMock().then((mock) => mock.withdrawConsent(mockState)) : realApi.withdrawConsent();
  },

  /** Drops this tab's session credential only; server-side data is not deleted. */
  forgetLocalSession() {
    if (apiMode === "real") realApi.forgetLocalSession();
  },

  getRecommendation(request: RecommendationRequest, mockOptions: RecommendationMockOptions = {}): Promise<RecommendationResponse> {
    return apiMode === "mock"
      ? loadMock().then((mock) => mock.getRecommendation(request, mockOptions))
      : realApi.getRecommendation(request);
  },

  getProvider(providerId: string, simulateMockError = false): Promise<ProviderDetail | null> {
    return apiMode === "mock" ? loadMock().then((mock) => mock.getProvider(providerId, simulateMockError)) : realApi.getProvider(providerId);
  },
};
