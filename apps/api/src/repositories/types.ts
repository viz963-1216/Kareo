import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CreatedSession,
  CreateConsentInput,
  KnowledgeCategory,
  KnowledgeRecord,
  KnowledgeStatusResponse,
  Jurisdiction,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
  ProviderServiceType,
  RecommendationItem,
  RecommendationRun,
  Session,
} from "../types/index.js";
import type { KnowledgeSnapshotRecord } from "../assessment/knowledgeSnapshot.js";

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
  // TASK-B-005：Recommendation 讀取該 Assessment 已保存的 location，不另外驗證輸入；
  // 找不到時回 null（呼叫端據此回 NOT_FOUND，不透露資源是否存在，見 sessionSecurityService）。
  findById(id: string): Promise<Assessment | null>;
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

  // B-008-r3（J-003 H-2）：同 (packId, packRecordId) 但內容包實質內容改變時，更新既有紀錄的內容並
  // 強制重回 NEEDS_REVIEW（不可靜默略過、也不可讓舊文字停留在 APPROVED）。只允許更新「尚未 PUBLISHED」
  // 的紀錄；呼叫端須先確認目前狀態不是 PUBLISHED（已發布的歷史紀錄不可被匯入覆寫）。
  updateRecordContent(
    id: string,
    content: Omit<KnowledgeRecord, "id" | "createdAt" | "updatedAt" | "packId" | "packRecordId" | "status" | "version">
  ): Promise<void>;

  // Jerry 委託修正第二輪（2026-09-27）：核准一律是單一 UPDATE，條件同時包含 status = 'NEEDS_REVIEW'
  // 「與」content_fingerprint = 呼叫端宣稱的預期值，兩者在同一次資料庫操作內原子檢查（不是先讀後寫的
  // 兩步驟，避免核准與匯入之間的競態：內容在核准當下已被改變，舊的核准請求絕不能生效）。
  // 沒有「只收 id、不驗內容」的核准入口——這個方法本身就是唯一入口，不能被繞過。
  // 回傳：approved＝實際被核准的 id；contentMismatched＝status 對但 content_fingerprint 對不上
  // （核准與匯入之間內容被改變）；其餘（不在 approved 也不在 contentMismatched）代表當下狀態
  // 本來就不是 NEEDS_REVIEW（已核准／已拒收／不存在），呼叫端可用「原始 id 清單 - 前兩者」算出。
  approveRecords(
    candidates: Array<{ id: string; expectedContentFingerprint: string }>
  ): Promise<{ approved: string[]; contentMismatched: string[] }>;

  // 版號是否已存在（任何狀態）：B-008-r2／D-03，發布前的第一層檢查（SQL function 內還有第二層防禦）。
  versionExists(versionId: string): Promise<boolean>;

  // Publish / Withdraw：跨 knowledge_versions 與 knowledge_records 兩張表，依 ARCHITECTURE §22 用單一交易的
  // Postgres function 包住（同 B-004 D-10 的模式），不提供分開寫入的方法。
  publishVersion(input: PublishVersionInput): Promise<{
    publishedRecordCount: number;
    supersededRecordCount: number;
    carriedForwardCount: number;
  }>;
  withdrawCurrentVersion(input: {
    reason: string;
    withdrawnBy: string;
    republishVersionId?: string | null;
  }): Promise<{ republishedVersionId: string | null }>;

  getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null>;

  // B-010：取出指定 PUBLISHED 版本的全部 PUBLISHED 紀錄（含來源機關），供 Assessment 建立單一版本的知識快照。
  findPublishedSnapshotRecords(versionId: string): Promise<KnowledgeSnapshotRecord[]>;
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

// TASK-B-005：篩選推薦候選用的查詢條件。district 為 null 時代表只依縣市比對（CITY_ROTATION，
// D-13a：服務範圍含該縣市任一行政區），否則依縣市＋行政區精確比對（DISTANCE／DISTRICT_ROTATION）。
export interface RecommendationCandidateQuery {
  serviceType: ProviderServiceType;
  city: string;
  district: string | null;
}

// 依 tasks/TASK-B-004.md：不讓 Frontend 直接查核心 Business Tables，
// Provider Detail 一律透過此 Repository -> Service -> Function 邊界存取。
export interface ProviderRepository {
  findDetailById(providerId: string): Promise<ProviderDetailResponse | null>;
  // 依 ARCHITECTURE §22 / MVP_DECISIONS D-10：三張表只能透過這一個方法、在單一交易內寫入
  // （全有或全無，upsert by id）。刻意不提供分表寫入方法，避免再出現半套資料。
  importDatasetAtomically(dataset: ProviderDatasetWrite): Promise<ProviderDatasetWriteCounts>;
  // TASK-B-005：status=ACTIVE、服務類型相符（provider_services.active）、服務範圍相符
  // （provider_service_areas.active，與地址分開，PRODUCT_SPEC §19）。回傳完整 Provider（含 lat/lng），
  // 由 Service 層判斷是否所有候選都有已驗證座標（lat/lng 皆非 null）才走 DISTANCE。
  findEligibleForRecommendation(query: RecommendationCandidateQuery): Promise<Provider[]>;
}

// TASK-B-005（Jerry 委託修正第二輪，2026-09-26，擴大 ARCHITECTURE §22 原子寫入核准範圍，
// 比照 Provider 匯入／知識發布撤回的既有模式）：insertRun 只是先在呼叫端暫存 Run 資料，
// 真正寫入（Run + Items 在單一交易內）發生在 insertItems 呼叫時；insertItems 失敗時，
// Run 完全不會寫入資料庫，不會留下沒有 Items、卻可能被後續 Lead 引用的孤立 Run
// （不用容易失敗的補償刪除冒充原子性——這裡沒有補償刪除，是真正的單一交易）。
// 呼叫順序仍是 insertRun 後接 insertItems，介面不變，呼叫端（recommendationService）不需要修改。
export interface RecommendationRepository {
  insertRun(run: RecommendationRun): Promise<void>;
  insertItems(items: RecommendationItem[]): Promise<void>;
}
