import type {
  AssessmentRequest,
  AssessmentResponse,
  CareNeed,
  ConsentRequest,
  ConsentResponse,
  SessionResponse,
} from "../types/api";

const wait = (milliseconds = 450) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

// These fixtures mirror the current Contract mock responses. Keep UI calls behind
// this adapter so Jerry can later replace its implementation with the real API.
export const mockApi = {
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
};
