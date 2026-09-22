import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CreateConsentInput,
  Session,
} from "../types/index.js";

// Repository Boundary：Service 層只依賴這些介面，不直接依賴 Supabase SDK，
// 確保業務邏輯（Consent 檢查等）不會被 Supabase 自動 API 繞過。
export interface SessionRepository {
  createSession(): Promise<Session>;
  exists(sessionId: string): Promise<boolean>;
}

export interface ConsentRepository {
  createConsent(input: CreateConsentInput): Promise<Consent>;
  // 依 accepted=true 才會建立 Consent 記錄（見 consentService），
  // 因此「存在最新一筆 Consent」即代表該 Session 已完成有效同意。
  findLatestBySession(sessionId: string): Promise<Consent | null>;
}

export interface CreateAssessmentRecord {
  assessment: Omit<Assessment, "id" | "createdAt" | "updatedAt">;
  careNeedProfile: Omit<CareNeedProfile, "id" | "assessmentId" | "createdAt">;
}

export interface AssessmentRepository {
  createAssessment(
    input: CreateAssessmentRecord
  ): Promise<{ assessment: Assessment; careNeedProfile: CareNeedProfile }>;
}
