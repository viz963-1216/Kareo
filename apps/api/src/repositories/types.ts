import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CrawlerRun,
  CreatedSession,
  CreateConsentInput,
  KnowledgeCategory,
  KnowledgeChange,
  KnowledgeRecord,
  KnowledgeStatusResponse,
  Jurisdiction,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
  Session,
} from "../types/index.js";

// Repository Boundary：Service 層只依賴這些介面，不直接依賴 Supabase SDK，
// 確保業務邏輯（Consent 檢查等）不會被 Supabase 自動 API 繞過。
export interface SessionRepository {
  // 依 TASK-B-011a：建立時同時產生密碼學隨機 token，回傳明文（只此一次），資料庫只存雜湊。
  createSession(): Promise<CreatedSession>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  touchSession(sessionId: string, updates: { lastSeenAt: string; expiresAt: string }): Promise<void>;
}

export interface ConsentRepository {
  createConsent(input: CreateConsentInput): Promise<Consent>;
  // 依 accepted=true 才會建立 Consent 記錄（見 consentService），且只回傳 withdrawnAt 為空的最新一筆；
  // 因此「找得到 Consent」即代表該 Session 已完成「目前仍有效」的同意（依 DATA_MODEL.md v0.2）。
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

// 依 tasks/TASK-B-008.md + contracts/knowledge/README.md。
export interface PublishVersionInput {
  versionId: string;
  recordIds: string[]; // 這批要變成 PUBLISHED 的 KnowledgeRecord id（必須目前狀態皆為 APPROVED）
  createdBy: string;
  approvedBy: string;
  notes: string | null;
}

export interface KnowledgeRepository {
  // Import：單一資料表、單一 insert 呼叫即為單一交易，天然原子；不需要另外包 rpc（跟 Provider 三表不同）。
  findByPackRecordIds(packId: string, packRecordIds: string[]): Promise<Set<string>>; // 已存在的 packRecordId，供冪等判斷
  findRecordsByPackId(packId: string): Promise<KnowledgeRecord[]>; // CLI 用：把 packRecordId 對應回資料庫 id
  findPublishedByKey(jurisdiction: Jurisdiction, category: KnowledgeCategory, title: string): Promise<KnowledgeRecord | null>;
  insertRecords(records: KnowledgeRecord[]): Promise<void>;

  // Approve：單一 UPDATE，內建於 WHERE status = 'NEEDS_REVIEW'，回傳實際更新的 id，供呼叫端偵測「有 id 沒被更新」。
  // KnowledgeRecord 沒有獨立的 approvedBy 欄位（依 DATA_MODEL.md 第 24 節），審核人記錄在 KnowledgeVersion.approvedBy。
  approveRecords(recordIds: string[]): Promise<string[]>;

  // Publish / Withdraw：跨 knowledge_versions 與 knowledge_records 兩張表，依 ARCHITECTURE §22 用單一交易的
  // Postgres function 包住（同 B-004 D-10 的模式），不提供分開寫入的方法。
  publishVersion(input: PublishVersionInput): Promise<{ publishedRecordCount: number; supersededRecordCount: number }>;
  withdrawCurrentVersion(input: {
    reason: string;
    withdrawnBy: string;
    republishVersionId?: string | null;
  }): Promise<{ republishedVersionId: string | null }>;

  getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null>;

  // Crawler（TASK-B-009）：依 source_id 找該來源目前最新一筆紀錄（不限狀態，任何 fetchedAt 最新者）
  // 作為 content hash 比對基準；沒有紀錄時回 null（來源尚未經人工匯入過任何內容）。
  findLatestRecordBySourceId(sourceId: string): Promise<KnowledgeRecord | null>;
  insertKnowledgeChange(change: KnowledgeChange): Promise<void>;
  insertCrawlerRun(run: CrawlerRun): Promise<void>;
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
