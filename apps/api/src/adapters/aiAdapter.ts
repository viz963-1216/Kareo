import type { CareNeed, CreateAssessmentInput } from "../types/index.js";

export interface CareNeedProfileDraft {
  careNeeds: CareNeed[];
  priority: CareNeed[];
  summary: string;
  warnings: string[];
}

// 依 tasks/TASK-B-003.md「AI Adapter Rule」：本專案不綁死特定 AI 供應商，
// Service 層只依賴此介面。正式 Provider（OpenAI / Claude / Gemini）由未來 Task 決定並實作，
// 屆時只需新增一個實作這個介面的 Adapter，不需改動 Service / Function 層。
//
// Adapter 只能：理解使用者資料、產生 CareNeedProfile、排定 careNeeds/priority、產生 summary。
// Adapter 不可以：選 Provider、排 Provider、回正式 CMS Level、回正式 Eligibility、
// 回 approvedBenefit、做醫療診斷。
export interface CareAssessmentAIAdapter {
  generateCareNeedProfile(input: CreateAssessmentInput): Promise<CareNeedProfileDraft>;
}
