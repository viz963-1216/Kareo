import type { AssessmentRuleTrace, CareNeed, CreateAssessmentInput } from "../types/index.js";
import type { EngineDiagnostic, KnowledgeSnapshot } from "../assessment/knowledgeSnapshot.js";

export interface CareNeedProfileDraft {
  careNeeds: CareNeed[];
  priority: CareNeed[];
  summary: string;
  warnings: string[];
}

// 每次評估綁定同一份 PUBLISHED 知識快照與同一個日期（Asia/Taipei YYYY-MM-DD），確保可重現。
export interface AssessmentEngineContext {
  knowledge: KnowledgeSnapshot;
  today: string;
}

// DATA_MODEL v0.2.2 §7 ruleTrace：只存規則 ID、模板 ID、引用的知識 recordId；不存自由文字或關鍵字命中片段。
export type RuleTrace = AssessmentRuleTrace;

export interface AssessmentEngineResult {
  profile: CareNeedProfileDraft;
  rulesVersion: string;
  ruleTrace: RuleTrace;
  diagnostics: EngineDiagnostic[];
}

// 介面名稱沿用 B-003（TASK-B-010：不做命名重構）。MVP 依 D-01 不使用 AI，
// 唯一的正式實作是 src/assessment/ruleBasedAssessmentEngine.ts（ASSESSMENT_RULES 確定性規則引擎）。
//
// 實作只能：產生 CareNeedProfile、排定 careNeeds/priority、依模板產生 summary。
// 實作不可以：選 Provider、排 Provider、回正式 CMS Level、回正式 Eligibility、
// 回 approvedBenefit、做醫療診斷、呼叫外部 AI／LLM 服務。
export interface CareAssessmentAIAdapter {
  generateCareNeedProfile(input: CreateAssessmentInput, context: AssessmentEngineContext): Promise<AssessmentEngineResult>;
}
