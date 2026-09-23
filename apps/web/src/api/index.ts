import type { ConsentRequest, ProviderDetail, RecommendationRequest, RecommendationResponse } from "../types/api";
import { mockApi, type RecommendationMockOptions } from "./mockAdapter";
import { ApiError, realApi } from "./realAdapter";

// TASK-J-003 integration switch. Mock is only for local development and deploy previews;
// any non-development build defaults to the real API unless VITE_KAREO_API_MODE=mock is set explicitly.
export const apiMode: "mock" | "real" =
  import.meta.env.VITE_KAREO_API_MODE ?? (import.meta.env.DEV ? "mock" : "real");

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
  createSession: apiMode === "mock" ? mockApi.createSession : realApi.createSession,

  async acceptConsent(sessionId: string) {
    if (!consentVersions) {
      throw new ApiError("CONSENT_VERSION_UNAVAILABLE", "服務說明文件尚在確認中，暫時無法開始評估。請直接聯絡 1966。", 0);
    }
    const body: ConsentRequest = { sessionId, ...consentVersions, accepted: true };
    return apiMode === "mock" ? mockApi.acceptConsent(body) : realApi.acceptConsent(body);
  },

  submitAssessment: apiMode === "mock" ? mockApi.submitAssessment : realApi.submitAssessment,

  getRecommendation(request: RecommendationRequest, mockOptions: RecommendationMockOptions = {}): Promise<RecommendationResponse> {
    return apiMode === "mock" ? mockApi.getRecommendation(request, mockOptions) : realApi.getRecommendation(request);
  },

  getProvider(providerId: string, simulateMockError = false): Promise<ProviderDetail | null> {
    return apiMode === "mock" ? mockApi.getProvider(providerId, simulateMockError) : realApi.getProvider(providerId);
  },
};
