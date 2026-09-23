import type {
  ProviderDetail,
  AssessmentRequest,
  AssessmentResponse,
  CareNeed,
  ConsentRequest,
  ConsentResponse,
  SessionResponse,
  RecommendationRequest,
  RecommendationResponse,
} from "../types/api";
import providerFixture from "../../../../contracts/mock/provider-response.json";
import {
  createRecommendationFixture,
  type RecommendationMockCount,
  type RecommendationMockRanking,
} from "./recommendationMockFixtures";

const wait = (milliseconds = 450) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export interface RecommendationMockOptions {
  providerCount?: RecommendationMockCount;
  ranking?: RecommendationMockRanking;
  simulateError?: boolean;
}

// These fixtures mirror the current Contract mock responses. Keep UI calls behind
// this adapter so Jerry can later replace its implementation with the real API.
export const mockApi = {
  async getProvider(providerId: string, simulateError = false): Promise<ProviderDetail | null> {
    await wait(650);
    if (simulateError) throw new Error("目前無法取得服務單位資料，請稍後再試。");
    if (providerId !== providerFixture.data.id) return null;
    return structuredClone(providerFixture.data) as ProviderDetail;
  },
  async createSession(): Promise<SessionResponse> {
    await wait();
    return {
      sessionId: "SES-MOCK-001",
      createdAt: new Date().toISOString(),
    };
  },

  async acceptConsent(request: ConsentRequest): Promise<ConsentResponse> {
    if (!request.sessionId || !request.accepted) {
      throw new Error("無法完成同意程序，請重新開始。");
    }
    await wait();
    return {
      consentId: "CON-MOCK-001",
      acceptedAt: new Date().toISOString(),
    };
  },

  async submitAssessment(request: AssessmentRequest): Promise<AssessmentResponse> {
    if (!request.sessionId) {
      throw new Error("請先同意服務說明後再開始評估。");
    }

    await wait(700);

    const careNeeds: CareNeed[] = [];
    if (request.needs.homeCare === "YES") careNeeds.push("HOME_CARE");
    if (request.needs.medicalNursing === "YES") careNeeds.push("HOME_MEDICAL_NURSING");
    if (request.needs.assistiveDevice === "YES") careNeeds.push("ASSISTIVE_DEVICE");
    if (request.needs.transportation === "YES") careNeeds.push("TRANSPORTATION");

    const summary = careNeeds.length
      ? "依目前提供的資訊，可能需要下列照護服務。建議依優先順序進一步向專業單位確認。"
      : "依目前提供的資訊，尚未辨識出明確的服務需求；如狀況改變或仍有疑問，建議聯絡 1966 確認。";

    return {
      assessmentId: "ASM-MOCK-001",
      knowledgeVersion: "KB-MOCK-001",
      careNeedProfile: {
        id: "CNP-MOCK-001",
        careNeeds,
        priority: careNeeds,
        summary,
        warnings: [
          "本結果僅為初步預估。",
          "實際資格、長照等級與補助仍需由 1966 或所在地長期照顧管理中心正式評估確認。",
        ],
      },
    };
  },

  async getRecommendation(
    request: RecommendationRequest,
    options: RecommendationMockOptions = {},
  ): Promise<RecommendationResponse> {
    if (!request.assessmentId) {
      throw new Error("缺少評估資料，請先完成初步評估。");
    }

    await wait(650);

    if (options.simulateError) {
      throw new Error("目前無法取得服務單位推薦，請稍後再試或聯絡 1966。");
    }

    return createRecommendationFixture(
      request.serviceType,
      options.providerCount,
      options.ranking,
    );
  },
};
