import type { CareAssessmentAIAdapter, CareNeedProfileDraft } from "./aiAdapter.js";
import type { CareNeed, CreateAssessmentInput } from "../types/index.js";

const MANDATORY_WARNINGS = [
  "本結果僅為初步預估。",
  "實際資格、長照等級與補助仍需由正式長照評估確認。",
];

// 測試 / 開發用的 Deterministic Adapter：不呼叫任何外部 AI 服務，
// 純粹依 needs.* 欄位規則產生 CareNeedProfile，讓 Assessment Flow 可在
// 沒有真實 AI Provider Token 的情況下被完整測試（見 tasks/TASK-B-003.md「AI Adapter Rule」）。
// 正式 Provider Adapter（OpenAI / Claude / Gemini）由未來 Task 決定並實作，不在本 Task 範圍內。
export class FakeAssessmentAIAdapter implements CareAssessmentAIAdapter {
  async generateCareNeedProfile(input: CreateAssessmentInput): Promise<CareNeedProfileDraft> {
    const careNeeds: CareNeed[] = [];

    if (input.needs.homeCare === "YES") careNeeds.push("HOME_CARE");
    if (input.needs.medicalNursing === "YES") careNeeds.push("HOME_MEDICAL_NURSING");
    if (input.needs.assistiveDevice === "YES") careNeeds.push("ASSISTIVE_DEVICE");
    if (input.needs.transportation === "YES") careNeeds.push("TRANSPORTATION");

    // Priority 目前依固定順序（HOME_CARE 優先），僅取交集，維持 Deterministic 行為。
    const priorityOrder: CareNeed[] = ["HOME_CARE", "TRANSPORTATION", "ASSISTIVE_DEVICE", "HOME_MEDICAL_NURSING"];
    const priority = priorityOrder.filter((need) => careNeeds.includes(need));

    const summary =
      careNeeds.length > 0
        ? `依目前提供的資訊，可能需要${careNeeds
            .map(careNeedLabel)
            .join("、")}相關服務。`
        : "目前提供的資訊尚不足以判斷明確的服務需求，建議提供更多細節或聯絡 1966 諮詢。";

    return {
      careNeeds,
      priority,
      summary,
      warnings: [...MANDATORY_WARNINGS],
    };
  }
}

function careNeedLabel(careNeed: CareNeed): string {
  const labels: Record<CareNeed, string> = {
    HOME_CARE: "居家照顧",
    HOME_MEDICAL_NURSING: "居家醫療與護理",
    ASSISTIVE_DEVICE: "輔具",
    TRANSPORTATION: "長照交通",
  };
  return labels[careNeed];
}
