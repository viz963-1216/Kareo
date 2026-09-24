import type {
  ProviderDetail,
  AssessmentLocation,
  AssessmentRequest,
  AssessmentResponse,
  CareNeed,
  ConsentRequest,
  ConsentResponse,
  ConsentWithdrawalResponse,
  LeadRequest,
  LeadResponse,
  SessionDeletionResponse,
  SessionResponse,
  RecommendationRequest,
  RecommendationResponse,
} from "../types/api";
import basicAssessmentFixture from "../../../../contracts/mock/assessment-response.json";
import subsidyNewTaipeiFixture from "../../../../contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json";
import leadFixture from "../../../../contracts/mock/lead-response.json";
import provider001 from "../../../../contracts/mock/providers/PROV-MOCK-001.json";
import provider002 from "../../../../contracts/mock/providers/PROV-MOCK-002.json";
import provider003 from "../../../../contracts/mock/providers/PROV-MOCK-003.json";
import provider101 from "../../../../contracts/mock/providers/PROV-MOCK-101.json";
import provider102 from "../../../../contracts/mock/providers/PROV-MOCK-102.json";
import provider103 from "../../../../contracts/mock/providers/PROV-MOCK-103.json";
import provider201 from "../../../../contracts/mock/providers/PROV-MOCK-201.json";
import provider202 from "../../../../contracts/mock/providers/PROV-MOCK-202.json";
import provider203 from "../../../../contracts/mock/providers/PROV-MOCK-203.json";
import { ApiError } from "./realAdapter";
import type { MockState, RecommendationMockCount, RecommendationMockRanking } from "./mockScenarios";
import { createRecommendationFixture, rankingForPrecision } from "./recommendationMockFixtures";

const wait = (milliseconds = 450) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const providerFixtures = [
  provider001,
  provider002,
  provider003,
  provider101,
  provider102,
  provider103,
  provider201,
  provider202,
  provider203,
] as const;

const providersById = new Map(
  providerFixtures.map((fixture) => [fixture.data.id, fixture.data as ProviderDetail]),
);

// Mock-only failure scenarios, selected with `?mockState=` on the page being tested (development and deploy
// previews only; the real API never reads them). See ./mockScenarios.ts.

export interface RecommendationMockOptions {
  providerCount?: RecommendationMockCount;
  /** Forces a ranking scenario; by default it follows the mock assessment's location precision. */
  ranking?: RecommendationMockRanking;
  state?: MockState;
}

const failedOnce = new Set<string>();

function simulateFailure(operation: string, state: MockState | undefined, message: string) {
  if (!state) return;
  if (state === "session-expired") throw new ApiError("SESSION_INVALID", "您的使用階段已過期，請重新開始。", 401);
  if (state === "knowledge-unavailable" && operation === "assessment") {
    throw new ApiError("KNOWLEDGE_UNAVAILABLE", "長照制度資料目前正在更新，暫時無法完成評估。請稍後再試或直接聯絡 1966。", 503);
  }
  if (state === "error" || (state === "error-once" && !failedOnce.has(operation))) {
    failedOnce.add(operation);
    throw new ApiError("INTERNAL_ERROR", message, 500);
  }
}

// Assessment location by assessmentId, so mock recommendations follow the precision the user submitted.
const assessmentLocations = new Map<string, AssessmentLocation>();
// Lead results by Idempotency-Key: a retry with the same key returns the original lead (API_CONTRACT §3.3).
const leadsByKey = new Map<string, LeadResponse>();
let leadCount = 0;

// These fixtures mirror the current Contract mock responses. Keep UI calls behind
// this adapter so Jerry can later replace its implementation with the real API.
export const mockApi = {
  async getProvider(providerId: string, simulateError = false): Promise<ProviderDetail | null> {
    await wait(650);
    if (simulateError) throw new Error("目前無法取得服務單位資料，請稍後再試。");
    const provider = providersById.get(providerId);
    return provider ? structuredClone(provider) : null;
  },
  async createSession(): Promise<SessionResponse> {
    await wait();
    failedOnce.clear();
    assessmentLocations.clear();
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

  async submitAssessment(request: AssessmentRequest, state?: MockState): Promise<AssessmentResponse> {
    if (!request.sessionId) {
      throw new ApiError("CONSENT_REQUIRED", "需要先同意服務說明後才能繼續，請重新開始。", 403);
    }

    await wait(700);
    simulateFailure("assessment", state, "評估暫時無法完成，請稍後再試或直接聯絡 1966。");

    const careNeeds: CareNeed[] = [];
    if (request.needs.homeCare === "YES") careNeeds.push("HOME_CARE");
    if (request.needs.medicalNursing === "YES") careNeeds.push("HOME_MEDICAL_NURSING");
    if (request.needs.assistiveDevice === "YES") careNeeds.push("ASSISTIVE_DEVICE");
    if (request.needs.transportation === "YES") careNeeds.push("TRANSPORTATION");

    // Contract fixtures first (contracts/mock/README.md, J-002-r4):
    //  - 新北市三重區 → WITH-SUBSIDY-NEW_TAIPEI.json (summary lines include possible subsidies);
    //  - any other answer with at least one need → assessment-response.json (no subsidy lines, i.e. the
    //    platform has no citable published data for that case).
    // Fixture care needs are fixed and do not follow the answers. No fixture covers "no needs", so that
    // case keeps the generated empty profile to exercise the EMPTY state.
    let response: AssessmentResponse;
    if (careNeeds.length === 0) {
      response = {
        assessmentId: "ASM-MOCK-001",
        knowledgeVersion: "KB-MOCK-001",
        careNeedProfile: {
          id: "CNP-MOCK-001",
          careNeeds,
          priority: careNeeds,
          summary: "依目前提供的資訊，尚未辨識出明確的服務需求；如狀況改變或仍有疑問，建議聯絡 1966 確認。",
          warnings: [
            "本結果僅為初步預估。",
            "實際資格、長照等級與補助仍需由 1966 或所在地長期照顧管理中心正式評估確認。",
          ],
        },
      };
    } else if (request.location.city === "新北市" && request.location.district === "三重區") {
      response = structuredClone(subsidyNewTaipeiFixture.data) as AssessmentResponse;
    } else {
      response = structuredClone(basicAssessmentFixture.data) as AssessmentResponse;
    }
    assessmentLocations.set(response.assessmentId, request.location);
    return response;
  },

  async getRecommendation(
    request: RecommendationRequest,
    options: RecommendationMockOptions = {},
  ): Promise<RecommendationResponse> {
    if (!request.assessmentId) {
      throw new Error("缺少評估資料，請先完成初步評估。");
    }

    await wait(650);
    simulateFailure("recommendation", options.state, "目前無法取得服務單位推薦，請稍後再試或聯絡 1966。");

    const precision = assessmentLocations.get(request.assessmentId)?.precision ?? "DISTRICT";
    return createRecommendationFixture(
      request.serviceType,
      options.providerCount,
      options.ranking ?? rankingForPrecision(precision),
    );
  },

  async createLead(request: LeadRequest, idempotencyKey: string, state?: MockState): Promise<LeadResponse> {
    if (!idempotencyKey) throw new ApiError("VALIDATION_ERROR", "缺少 Idempotency-Key。", 400);
    if (request.contactConsent !== true) throw new ApiError("VALIDATION_ERROR", "需要勾選同意聯絡。", 400);
    leadCount += 1;
    await wait(900);
    const existing = leadsByKey.get(idempotencyKey);
    if (existing) return structuredClone(existing);
    simulateFailure("lead", state, "媒合需求暫時無法送出，請稍後再試。");
    const lead = { ...(leadFixture.data as LeadResponse), createdAt: new Date().toISOString() };
    leadsByKey.set(idempotencyKey, lead);
    return structuredClone(lead);
  },

  /** Mock-only: how many lead requests reached the mock API (double-submit acceptance check). */
  leadRequestCount() {
    return leadCount;
  },

  async withdrawConsent(state?: MockState): Promise<ConsentWithdrawalResponse> {
    await wait();
    simulateFailure("withdraw", state, "撤回同意暫時無法送出，您的同意仍然有效，請稍後再試。");
    assessmentLocations.clear();
    leadsByKey.clear();
    // No contract fixture exists for POST /consent/withdraw; shape follows API_CONTRACT §7.
    return { withdrawnAt: new Date().toISOString(), sessionStatus: "DELETION_REQUESTED" };
  },

  async deleteSession(state?: MockState): Promise<SessionDeletionResponse> {
    await wait();
    simulateFailure("delete", state, "刪除要求暫時無法送出，您的資料尚未刪除，請稍後再試。");
    assessmentLocations.clear();
    leadsByKey.clear();
    // No contract fixture exists for DELETE /session; shape follows API_CONTRACT §6.
    return {
      sessionId: "SES-MOCK-001",
      status: "DELETION_REQUESTED",
      deletionScheduledBefore: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },
};
