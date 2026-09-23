import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CreateConsentInput,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
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

export interface ProviderDatasetWrite {
  providers: Provider[];
  services: ProviderService[];
  serviceAreas: ProviderServiceArea[];
}

export interface ProviderDatasetWriteCounts {
  providers: number;
  providerServices: number;
  providerServiceAreas: number;
}

// 依 tasks/TASK-B-004.md：不讓 Frontend 直接查核心 Business Tables，
// Provider Detail 一律透過此 Repository -> Service -> Function 邊界存取。
export interface ProviderRepository {
  findDetailById(providerId: string): Promise<ProviderDetailResponse | null>;
  // 依 ARCHITECTURE §22 / MVP_DECISIONS D-10：三張表只能透過這一個方法、在單一交易內寫入
  // （全有或全無，upsert by id）。刻意不提供分表寫入方法，避免再出現半套資料。
  importDatasetAtomically(dataset: ProviderDatasetWrite): Promise<ProviderDatasetWriteCounts>;
}
