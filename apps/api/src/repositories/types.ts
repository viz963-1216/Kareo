import type {
  AdminKnowledgeChangeSummary,
  AdminKnowledgeRecordSummary,
  AdminKnowledgeStatus,
  AdminPublishResult,
  AdminSession,
  Assessment,
  CareNeedProfile,
  Consent,
  ContentPack,
  ContentPackUpsertAction,
  ContentPackUpsertInput,
  CrawlerRun,
  CrawlerSnapshot,
  CreatedAdminSession,
  CreatedSession,
  CreateConsentInput,
  DeletionRun,
  InternalOperator,
  KnowledgeCategory,
  KnowledgeChange,
  KnowledgeChangeStatus,
  KnowledgeRecord,
  KnowledgeRecordReviewSource,
  KnowledgeRecordStatus,
  KnowledgeStatusResponse,
  Jurisdiction,
  Lead,
  LeadAccessEvent,
  LeadStatus,
  LeadStatusEvent,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
  ProviderServiceType,
  PublishPlan,
  RateLimitCheckResult,
  RecommendationItem,
  RecommendationRun,
  RestorableVersionsResponse,
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

  // TASK-B-011b：DELETE /api/v1/session（PRIVACY_AND_RETENTION §6.1）。同一交易內：session 只在
  // 目前 ACTIVE 時才能轉為 DELETION_REQUESTED（CAS），並立即取消該 session 尚未終態的 Lead、清空
  // 聯絡欄位（見 migration 0019 request_session_deletion）。updated=false 代表 session 不存在或
  // 已經不是 ACTIVE（重複呼叫、或已經被 consent withdraw 標記）。
  requestDeletion(sessionId: string, now: string): Promise<{ updated: boolean; leadsCancelled: number }>;

  // TASK-B-011b：每日到期清理作業（PRIVACY_AND_RETENTION §6.3，2026-10-03 Jerry D-05 確認四條
  // 保存期限：session／評估資料 90 天、Lead 聯絡欄位 180 天、Lead 案件紀錄 1 年、Consent 3 年）。
  // dryRun=true 只計算不刪除，四項計數都要回傳供冪等驗證比對。
  runDeletionCleanup(input: {
    now: string;
    dryRun: boolean;
  }): Promise<{ sessionsDeleted: number; leadsContactCleared: number; leadsDeleted: number; consentsDeleted: number }>;
  insertDeletionRun(run: DeletionRun): Promise<void>;
}

export interface ConsentRepository {
  createConsent(input: CreateConsentInput): Promise<Consent>;
  // 依 accepted=true 才會建立 Consent 記錄（見 consentService），且只回傳 withdrawnAt 為空的最新一筆；
  // 因此「找得到 Consent」即代表該 Session 已完成「目前仍有效」的同意（依 DATA_MODEL.md v0.2）。
  findLatestBySession(sessionId: string): Promise<Consent | null>;

  // TASK-B-011b：POST /api/v1/consent/withdraw（PRIVACY_AND_RETENTION §3.3）。同一交易內：標記最新
  // 仍生效的 Consent 為已撤回、session 轉 DELETION_REQUESTED、立即取消尚未終態的 Lead 並清空聯絡
  // 欄位（見 migration 0019 withdraw_consent）。updated=false 代表這個 session 目前沒有仍生效的
  // Consent（已經撤回過，或從未建立）。
  withdraw(sessionId: string, now: string): Promise<{ updated: boolean; leadsCancelled: number }>;
}

// TASK-B-011b：ARCHITECTURE §20.4 持久化限流（DATA_MODEL §39）。key 由呼叫端組成
// （規則名稱＋session id 或 IP 雜湊），Repository 不關心 key 的組成規則。
export interface RateLimitRepository {
  checkAndIncrement(input: { key: string; windowSeconds: number; limit: number; now: string }): Promise<RateLimitCheckResult>;
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

  // Crawler（TASK-B-009）：依 source_id 找該來源目前最新一筆紀錄（不限狀態，任何 fetchedAt 最新者）
  // 作為 content hash 比對基準；沒有紀錄時回 null（來源尚未經人工匯入過任何內容）。
  findLatestRecordBySourceId(sourceId: string): Promise<KnowledgeRecord | null>;
  // 冪等：同一 (knowledgeRecordId, newContentHash) 若已存在一筆 status='NEEDS_REVIEW' 的
  // KnowledgeChange，不會重複建立（DB 層以 partial unique index 保障，見 migration 0013），
  // 回傳 inserted=false；呼叫端據此判斷這次是否為「真正的新變更」（B-009-r2，Jerry PR #37 第 3 項）。
  insertKnowledgeChange(change: KnowledgeChange): Promise<{ inserted: boolean }>;
  insertCrawlerRun(run: CrawlerRun): Promise<void>;

  // Jerry 委託修正第二輪（2026-09-27）：保存原始快照本身（不是只有雜湊），掛在 source_id
  // （一律存在），不掛在 knowledge_record_id（可能還沒有）。
  insertSnapshot(snapshot: CrawlerSnapshot): Promise<void>;
  // 該來源最新一筆快照（依 fetchedAt），用來判斷「自上次抓取是否改變」（跟「是否需要人工審核」
  // 分開——後者仍是跟 findLatestRecordBySourceId() 的結果比對）。沒有快照時回 null（第一次抓取）。
  findLatestSnapshotBySourceId(sourceId: string): Promise<CrawlerSnapshot | null>;

  // B-010：取出指定 PUBLISHED 版本的全部 PUBLISHED 紀錄（含來源機關），供 Assessment 建立單一版本的知識快照。
  findPublishedSnapshotRecords(versionId: string): Promise<KnowledgeSnapshotRecord[]>;

  // DATA_MODEL §26b：內容包登錄。同一 packId 已登錄時，recordsFingerprint（逐筆內容）不同一律拋出
  // PACK_CONTENT_CHANGED（必須改用新 packId），不論這次宣告的 status；內容相同時只允許
  // NEEDS_REVIEW → APPROVED 升級與 review／版號更新。見 migration 0020 upsert_content_pack。
  upsertContentPack(input: ContentPackUpsertInput): Promise<ContentPackUpsertAction>;
  findContentPackById(packId: string): Promise<ContentPack | null>;

  // DATA_MODEL §26c：回填既有已核准紀錄的逐筆審核證據（source=CLI_PACK）。審核人／時間取自已核准的
  // 內容包 JSON，不使用執行當下時間；同一 (紀錄, CLI_PACK, 內容指紋) 已存在則不重複寫入。
  // 不變更紀錄的狀態或內容。回傳 inserted=false 代表已存在。
  backfillRecordReviewEvent(input: {
    recordId: string;
    reviewedBy: string;
    reviewedAt: string;
    reason: string | null;
    contentFingerprint: string;
  }): Promise<{ inserted: boolean }>;

  // approveKnowledgePack（CLI）用：跟 admin 的 decision 端點共用同一份審核證據表
  // （knowledge_record_review_events，source 區分 CLI_PACK／ADMIN_API），同一交易內完成原子
  // UPDATE 與審核證據寫入（見 migration 0020 approve_or_reject_knowledge_record）。
  approveOrRejectRecordWithReview(input: {
    recordId: string;
    decision: "APPROVED" | "REJECTED";
    reason: string | null;
    expectedContentFingerprint: string;
    reviewedBy: string;
    source: KnowledgeRecordReviewSource;
  }): Promise<{ updated: boolean }>;
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
  // TASK-B-006：Lead 建立時需驗證 recommendationId 屬於同一 session（透過 assessmentId 反查，
  // 見 leadService）且 providerId／serviceType 出現在該次推薦結果中（API_CONTRACT §12、
  // ARCHITECTURE §20.3 第 5 步）。找不到時回 null（呼叫端據此回 NOT_FOUND，不透露資源是否存在）。
  findRunWithItems(id: string): Promise<{ run: RecommendationRun; items: RecommendationItem[] } | null>;
}

// TASK-B-006，依 docs/DATA_MODEL.md 第 22、37-38 節、docs/LEAD_OPERATIONS.md。
// J-003-r8（Jerry 委託審查 #47，問題 3）：同一 (sessionId, idempotencyKey) 這次請求最終解析到
// 哪一筆 Lead 的不可變記錄；`duplicate` 是這個 key 第一次被使用時的業務重複判斷結果，重送時原樣
// 帶出，不重新計算（該 Lead 當下可能已經不是「尚未終態」，但這不影響它當初是不是業務重複）。
export interface LeadIdempotencyRecord {
  leadId: string;
  requestFingerprint: string;
  duplicate: boolean;
}

export interface LeadRepository {
  // API_CONTRACT §12 / ARCHITECTURE §20.5：同一 session+provider+serviceType 尚未終態的既有 Lead。
  findOpenBySessionProviderService(
    sessionId: string,
    providerId: string,
    serviceType: ProviderServiceType
  ): Promise<Lead | null>;
  // 依 ARCHITECTURE §20.5：以資料庫唯一約束保證不重複寫入 open-duplicate，不以應用層先查後寫代替。
  // 違反唯一約束時回 inserted=false，呼叫端須重新查詢既有的未終態 Lead（併發下的競態轉為正確的
  // 既有結果回應，同 B-009 insertKnowledgeChange 的既有模式）。
  insertLead(lead: Lead): Promise<{ inserted: boolean }>;

  // J-003-r8（問題 3）：冪等判斷的唯一依據——不論這次請求是真的建立新 Lead，還是找到既有的
  // 業務重複 Lead 而回傳它，都必須記錄在這裡，否則該 Lead 結案後同一 key 重送會錯誤地建立第二筆
  // Lead（見 migration 0018 lead_idempotency_records 的欄位註解）。
  findIdempotencyRecord(sessionId: string, idempotencyKey: string): Promise<LeadIdempotencyRecord | null>;
  // 違反唯一約束時回 inserted=false，呼叫端重新查詢 findIdempotencyRecord 取得贏得競態的那筆記錄。
  insertIdempotencyRecord(input: {
    sessionId: string;
    idempotencyKey: string;
    leadId: string;
    requestFingerprint: string;
    duplicate: boolean;
  }): Promise<{ inserted: boolean }>;

  findById(id: string): Promise<Lead | null>;
  listLeads(filter: { status: LeadStatus | null; since: string | null }): Promise<Lead[]>;

  // J-003-r8（問題 2）：reveal-contact 只能由「被指派案件」的操作者執行（LEAD_OPERATIONS §2）。
  // 單一 UPDATE 內原子完成「若尚未指派則指派給這次呼叫的操作者（第一個 reveal-contact 的操作者
  // 視為接手這個案件），否則維持原指派對象」，回傳目前（可能剛被設定、也可能本來就有的）
  // assignedOperatorId；呼叫端比對是否等於自己，不等於就是別人的案件，拒絕顯示聯絡資料。
  claimLeadForReveal(leadId: string, operatorId: string): Promise<{ lead: Lead; assignedOperatorId: string } | null>;
  insertAccessEvent(event: LeadAccessEvent): Promise<void>;

  // J-003-r8（問題 1）：CAS 狀態更新與 LeadStatusEvent 寫入必須同一交易完成，不是分開的兩次呼叫
  // （見 migration 0018 update_lead_status_with_event）。expectedStatus 對不上時回傳 false
  // （未更新、未寫入任何事件），呼叫端據此回 INVALID_STATUS_TRANSITION。
  updateLeadStatusWithEvent(input: {
    leadId: string;
    expectedStatus: LeadStatus;
    toStatus: LeadStatus;
    statusReason: string | null;
    firstContactedAt: string | null;
    closedAt: string | null;
    updatedAt: string;
    event: Omit<LeadStatusEvent, "id" | "leadId" | "fromStatus" | "toStatus" | "createdAt"> & { id: string };
  }): Promise<boolean>;

  findOperatorById(id: string): Promise<InternalOperator | null>;
}

// TASK-B-012，依 docs/API_CONTRACT.md §26、docs/DATA_MODEL.md 第 36、41 節。
// publish-preview／publish（§26.8-9）不在此介面：candidate 內容包的 intendedKnowledgeVersion／
// status 目前完全沒有持久化（只存在 CLI 讀取的內容包 JSON 檔案裡），Admin API 只能存取資料庫，
// 無法重建這兩個端點需要的 targetVersionId 與 blockers；此為已知架構缺口，留待 Jerry 決定
// 持久化方案後再補（見 PR Known Issues）。
export interface AdminKnowledgeRepository {
  findOperatorById(id: string): Promise<InternalOperator | null>;
  createAdminSession(session: CreatedAdminSession & { tokenHash: string }): Promise<void>;
  findAdminSessionByTokenHash(tokenHash: string): Promise<AdminSession | null>;

  getAdminKnowledgeStatus(): Promise<AdminKnowledgeStatus>;
  // MVP 只接受 NEEDS_REVIEW（API_CONTRACT §26.2），介面仍接受任意狀態以便未來擴充，不在此限制。
  listChanges(status: KnowledgeChangeStatus): Promise<AdminKnowledgeChangeSummary[]>;
  listRecords(status: KnowledgeRecordStatus): Promise<AdminKnowledgeRecordSummary[]>;

  // decision／dismiss 更新前的唯讀查詢，用來分類找不到 vs 狀態不對（NOT_FOUND vs
  // INVALID_STATUS_TRANSITION），不是原子操作本身。
  findRecordById(id: string): Promise<AdminKnowledgeRecordSummary | null>;
  findChangeById(id: string): Promise<AdminKnowledgeChangeSummary | null>;

  // 沿用 B-008-r4 approveRecords 的原子檢查模式（status=NEEDS_REVIEW 且 content_fingerprint 相符），
  // 並在同一交易內寫入 AdminAuditEvent（見 migration 0019 admin_decide_knowledge_record）。
  // updated=false 時呼叫端須另外用 findRecordById 分類原因，這裡不分類。
  decideRecord(input: {
    recordId: string;
    decision: "APPROVED" | "REJECTED";
    reason: string;
    expectedContentFingerprint: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ updated: boolean; record: AdminKnowledgeRecordSummary | null }>;

  dismissChange(input: {
    changeId: string;
    reason: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ updated: boolean; change: AdminKnowledgeChangeSummary | null }>;

  // API_CONTRACT §26.10：符合恢復條件（ARCHIVED、從未被撤回、knowledge_version_records 至少
  // 1 筆、快照內無失效紀錄）的版本清單。
  listRestorableVersions(): Promise<RestorableVersionsResponse>;

  // API_CONTRACT §26.11：withdrawVersionId／republishVersionId 的一致性檢查、實際撤回寫入（沿用
  // withdraw_knowledge_version）、稽核紀錄，三者在同一交易內完成（見 migration 0019
  // admin_withdraw_knowledge_version）；「目前版本已變」「恢復目標不符合條件」以 KNOWLEDGE_STATE_CHANGED
  // 標記回傳，不是一般例外。
  adminWithdraw(input: {
    withdrawVersionId: string;
    republishVersionId: string | null;
    reason: string;
    operatorId: string;
    auditId: string;
    now: string;
    today: string;
  }): Promise<{ stateChanged: boolean; republishedVersionId: string | null }>;

  // TASK-B-012-r3（Jerry 指示 2）：預覽與發布共用的唯一計畫計算（見 migration 0020
  // compute_publish_plan）。純讀取，不寫入任何資料。
  computePublishPlan(): Promise<PublishPlan>;

  // 同一交易內：取得鎖 → 重算計畫與 token → 跟操作者確認時的 versionId／previewToken 比對 →
  // 不一致或重算後有 blocker 都不寫入 → 一致才沿用 publish_knowledge_version 寫入 → 寫稽核
  // （見 migration 0020 admin_publish_knowledge_version）。stateChanged=true 時資料完全不變。
  adminPublish(input: {
    versionId: string;
    previewToken: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ stateChanged: boolean; result: AdminPublishResult | null }>;
}
