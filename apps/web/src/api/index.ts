import type { AssessmentRequest, ConsentRequest, ProviderDetail, RecommendationRequest, RecommendationResponse } from "../types/api";
import type { RecommendationMockOptions } from "./mockAdapter";
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

  submitAssessment(request: AssessmentRequest) {
    return apiMode === "mock" ? loadMock().then((mock) => mock.submitAssessment(request)) : realApi.submitAssessment(request);
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
