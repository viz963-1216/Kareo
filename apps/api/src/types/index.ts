// 依 docs/DATA_MODEL.md 第 4、6 節（v0.2）。欄位/型態不得自行新增或修改。

export type SessionStatus = "ACTIVE" | "DELETION_REQUESTED" | "DELETED";

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  // v0.2（TASK-B-011a）：tokenHash 只在 Repository 內部使用，不對外回傳；
  // lastSeenAt/expiresAt 用於有效期判斷；status/deletedAt 對應 ARCHITECTURE §20.2、20.7。
  lastSeenAt: string | null;
  expiresAt: string;
  status: SessionStatus;
  deletedAt: string | null;
}

// POST /api/v1/session 建立時，明文 token 只在這裡短暫存在，回傳給呼叫端後即丟棄，不進資料庫。
export interface CreatedSession extends Session {
  sessionToken: string;
}

export interface Consent {
  id: string;
  sessionId: string;
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  acceptedAt: string;
  withdrawnAt: string | null;
}

export interface CreateConsentInput {
  sessionId: string;
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  accepted: boolean;
}

// 依 docs/DATA_MODEL.md 第 8-16 節。Enum 值不得自行新增/修改。
export type AgeRange = "UNDER_50" | "50_64" | "65_74" | "75_84" | "85_PLUS" | "UNKNOWN";
export type LocationPrecision = "NONE" | "CITY" | "DISTRICT" | "EXACT" | "GPS";
export type LivingSituation =
  | "ALONE"
  | "WITH_FAMILY"
  | "WITH_CAREGIVER"
  | "INSTITUTION"
  | "OTHER"
  | "UNKNOWN";
export type CaregiverSituation =
  | "NO_CAREGIVER"
  | "FAMILY_AVAILABLE"
  | "FAMILY_LIMITED"
  | "PAID_CAREGIVER"
  | "OTHER"
  | "UNKNOWN";
export type MobilityLevel = "INDEPENDENT" | "NEEDS_ASSISTANCE" | "WHEELCHAIR" | "BEDRIDDEN" | "UNKNOWN";
export type DailyLivingLevel =
  | "INDEPENDENT"
  | "PARTIAL_ASSISTANCE"
  | "HIGH_ASSISTANCE"
  | "FULL_ASSISTANCE"
  | "UNKNOWN";
export type ServiceNeed = "YES" | "NO" | "UNKNOWN";
export type AssessmentStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type CareNeed = "HOME_CARE" | "HOME_MEDICAL_NURSING" | "ASSISTIVE_DEVICE" | "TRANSPORTATION";
// 依 docs/DATA_MODEL.md §8a（2026-09-24，D-17）。選填，未提供視為 UNKNOWN。
export type DisabilityCertificate = "YES" | "NO" | "UNKNOWN";
// 依 docs/DATA_MODEL.md §8b（2026-09-24，D-17a）。選填，未提供視為 UNKNOWN。
export type IncomeCategory = "LOW_INCOME" | "MIDDLE_LOW_INCOME" | "ALLOWANCE" | "GENERAL" | "UNKNOWN";

// 依 API_CONTRACT v0.2.2 §8：四個子欄位一律出現，依 precision 不適用者為 null。
export interface AssessmentLocationInput {
  city: string | null;
  district: string | null;
  precision: LocationPrecision;
  lat: number | null;
  lng: number | null;
}

export interface AssessmentNeedsInput {
  homeCare: ServiceNeed;
  medicalNursing: ServiceNeed;
  assistiveDevice: ServiceNeed;
  transportation: ServiceNeed;
}

// 依 docs/API_CONTRACT.md 第 8 節 Request Body。
export interface CreateAssessmentInput {
  sessionId: string;
  ageRange: AgeRange;
  location: AssessmentLocationInput;
  livingSituation: LivingSituation;
  caregiverSituation: CaregiverSituation;
  mobilityLevel: MobilityLevel;
  dailyLivingLevel: DailyLivingLevel;
  needs: AssessmentNeedsInput;
  disabilityCertificate: DisabilityCertificate;
  incomeCategory: IncomeCategory;
  freeText: string;
}

// 只含規則 ID、模板 ID、知識 recordId；不含自由文字或關鍵字命中片段。
export interface AssessmentRuleTrace {
  needs: Array<{ need: CareNeed; basis: "USER_YES" | "STRUCTURED_RULE" | "KEYWORD"; ruleIds: string[] }>;
  templateIds: string[];
  knowledgeRecordIds: string[];
}

// 依 docs/DATA_MODEL.md 第 7 節。
export interface Assessment {
  id: string;
  sessionId: string;
  ageRange: AgeRange;
  city: string | null;
  district: string | null;
  locationPrecision: LocationPrecision;
  lat: number | null;
  lng: number | null;
  livingSituation: LivingSituation;
  caregiverSituation: CaregiverSituation;
  mobilityLevel: MobilityLevel;
  dailyLivingLevel: DailyLivingLevel;
  disabilityCertificate: DisabilityCertificate;
  incomeCategory: IncomeCategory;
  homeCareNeed: ServiceNeed;
  medicalNursingNeed: ServiceNeed;
  assistiveDeviceNeed: ServiceNeed;
  transportationNeed: ServiceNeed;
  freeText: string;
  status: AssessmentStatus;
  knowledgeVersion: string;
  // DATA_MODEL v0.2.2 §7（J-002-r4）：不回傳前端。
  rulesVersion: string;
  ruleTrace: AssessmentRuleTrace;
  createdAt: string;
  updatedAt: string;
}

// 依 docs/DATA_MODEL.md 第 16 節。
export interface CareNeedProfile {
  id: string;
  assessmentId: string;
  careNeeds: CareNeed[];
  priority: CareNeed[];
  summary: string;
  warnings: string[];
  createdAt: string;
}

// 依 docs/DATA_MODEL.md 第 17 節。
export type ProviderType = "HOME_CARE" | "HOME_MEDICAL_NURSING" | "ASSISTIVE_DEVICE" | "OTHER";
export type ProviderStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";
// 依 docs/DATA_MODEL.md 第 17 節（v0.2.5，D-19 Q2）。ASSISTIVE_DEVICE_CENTER 一律 type=OTHER、
// 沒有 ProviderService，推薦（§20）永遠不會選到。既有資料未提供者視為 SERVICE_PROVIDER。
export type ProviderResourceCategory = "SERVICE_PROVIDER" | "ASSISTIVE_DEVICE_CENTER";

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  resourceCategory: ProviderResourceCategory;
  address: string;
  city: string;
  district: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  status: ProviderStatus;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

// 依 docs/DATA_MODEL.md 第 18 節。serviceType 只能使用 Provider 相關三種類型（不含 OTHER）。
export type ProviderServiceType = "HOME_CARE" | "HOME_MEDICAL_NURSING" | "ASSISTIVE_DEVICE";

export interface ProviderService {
  id: string;
  providerId: string;
  serviceType: ProviderServiceType;
  active: boolean;
}

// 依 docs/DATA_MODEL.md 第 19 節。
export interface ProviderServiceArea {
  id: string;
  providerId: string;
  city: string;
  district: string;
  active: boolean;
}

// 依 docs/DATA_MODEL.md 第 19b 節（v0.2.5，D-19 Q1）：記錄「已列於該縣市政府特約名單」的事實，
// 不是服務範圍，推薦不讀取。
export interface ProviderContractRegion {
  id: string;
  providerId: string;
  city: string;
  serviceType: ProviderServiceType;
  sourceId: string | null;
  checkedAt: string | null;
  active: boolean;
}

// 公開時只回 city／serviceType（DATA_MODEL §19b：「來源與查核日期留在資料報告」）。
export type PublicContractRegion = { city: string; serviceType: ProviderServiceType };

// 依推導值（serviceAreas 是否非空），不另存欄位；DATA_MODEL §19。
export type ServiceAreaStatus = "VERIFIED" | "UNCONFIRMED";

// 依 docs/API_CONTRACT.md 第 10 節 GET /api/v1/providers/{providerId} Response。
export interface ProviderDetailResponse {
  id: string;
  name: string;
  type: ProviderType;
  resourceCategory: ProviderResourceCategory;
  address: string;
  city: string;
  district: string;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  verified: boolean;
  services: ProviderServiceType[];
  serviceAreas: Array<{ city: string; district: string }>;
  serviceAreaStatus: ServiceAreaStatus;
  contractRegions: PublicContractRegion[];
}

// ===== Resource Lookup（TASK-B-013，依 docs/API_CONTRACT.md §10a v0.6）=====

export type AreaFilter = "LOCATED_IN" | "SERVICE_AREA";

// 一律回傳 10 個鍵，值為後端實際套用、補上預設值後的條件（§10a）。
export interface ProviderLookupAppliedFilters {
  resourceCategory: ProviderResourceCategory | null;
  serviceType: ProviderServiceType | null;
  city: string | null;
  district: string | null;
  areaFilter: AreaFilter | null;
  includeUnconfirmed: boolean;
  contractCity: string | null;
  q: string | null;
  page: number;
  pageSize: number;
}

// 欄位只有這 15 個（v0.6 加入 resourceCategory、contractRegions），與 §10 同名欄位值相同；
// 不得回傳 lat/lng/status/createdAt/updatedAt/rank/distanceKm/reasons。
export interface ProviderLookupItem {
  id: string;
  name: string;
  type: ProviderType;
  resourceCategory: ProviderResourceCategory;
  services: ProviderServiceType[];
  address: string;
  city: string;
  district: string;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  verified: boolean;
  serviceAreaStatus: ServiceAreaStatus;
  contractRegions: PublicContractRegion[];
  // 只有 areaFilter=SERVICE_AREA 時為 VERIFIED／UNCONFIRMED；其餘為 null。
  areaMatch: ServiceAreaStatus | null;
}

export interface ProviderLookupResponse {
  items: ProviderLookupItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  // 只有 areaFilter=SERVICE_AREA 時為數字；其餘為 null。
  unconfirmedCount: number | null;
  appliedFilters: ProviderLookupAppliedFilters;
  notice: string;
}

// ===== Recommendation（TASK-B-005，依 docs/DATA_MODEL.md 第 20-21 節）=====

export type RankingType = "DISTANCE" | "DISTRICT_ROTATION" | "CITY_ROTATION" | "NO_LOCATION";

export interface RecommendationRun {
  id: string;
  assessmentId: string;
  serviceType: ProviderServiceType;
  rankingType: RankingType;
  locationPrecision: LocationPrecision;
  knowledgeVersion: string;
  createdAt: string;
}

export interface RecommendationItem {
  id: string;
  recommendationRunId: string;
  providerId: string;
  rank: 1 | 2 | 3;
  score: number;
  distanceKm: number | null;
  reasons: string[];
  createdAt: string;
}

// 依 docs/API_CONTRACT.md 第 9 節 Response 格式（providers[] 單筆）。
export interface RecommendationProviderResult {
  id: string;
  name: string;
  type: ProviderType;
  address: string;
  district: string;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  verified: boolean;
  rank: 1 | 2 | 3;
  distanceKm: number | null;
  reasons: string[];
}

export interface RecommendationResult {
  recommendationId: string;
  serviceType: ProviderServiceType;
  rankingType: RankingType;
  locationPrecision: LocationPrecision;
  providers: RecommendationProviderResult[];
  notice: string;
}

// TASK-B-004 Import 用：A 提供的 staging dataset 原始（未驗證）格式。
// 欄位刻意設為寬鬆 unknown/optional，因為來源資料可能缺欄位（例如 provider-services
// 目前缺 id/active），必須先驗證才能決定是否匯入，不得自行猜值。
export interface RawProviderRecord {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  // 選填：來源未提供時視為 SERVICE_PROVIDER（既有資料不受影響），依 DATA_MODEL §17。
  resourceCategory?: unknown;
  address?: unknown;
  city?: unknown;
  district?: unknown;
  lat?: unknown;
  lng?: unknown;
  phone?: unknown;
  website?: unknown;
  googleMapsUrl?: unknown;
  status?: unknown;
  verified?: unknown;
}

export interface RawProviderServiceRecord {
  id?: unknown;
  providerId?: unknown;
  serviceType?: unknown;
  active?: unknown;
}

export interface RawProviderServiceAreaRecord {
  id?: unknown;
  providerId?: unknown;
  city?: unknown;
  district?: unknown;
  active?: unknown;
}

// TASK-B-013（D-19 Q1）：選填陣列，來源可能完全沒有特約縣市資料。
export interface RawProviderContractRegionRecord {
  id?: unknown;
  providerId?: unknown;
  city?: unknown;
  serviceType?: unknown;
  sourceId?: unknown;
  checkedAt?: unknown;
  active?: unknown;
}

export interface ProviderImportDataset {
  providers: RawProviderRecord[];
  providerServices: RawProviderServiceRecord[];
  providerServiceAreas: RawProviderServiceAreaRecord[];
  providerContractRegions: RawProviderContractRegionRecord[];
}

// commit：正式匯入，任何一筆拒收則整批不寫入。dry-run：只驗證與產生報告，永不寫入。
// 刻意不提供「部分接受並寫入」模式，避免誤用成正式 gate。
export type ProviderImportMode = "commit" | "dry-run";

export interface ProviderImportReport {
  mode: ProviderImportMode;
  written: boolean;
  // 只有 commit 模式且寫入成功時才有值；數字來自資料庫交易實際寫入的筆數。
  writtenCounts: {
    providers: number;
    providerServices: number;
    providerServiceAreas: number;
    providerContractRegions: number;
  } | null;
  providersValid: number;
  providersRejected: Array<{ record: RawProviderRecord; reasons: string[] }>;
  servicesValid: number;
  servicesRejected: Array<{ record: RawProviderServiceRecord; reasons: string[] }>;
  serviceAreasValid: number;
  serviceAreasRejected: Array<{ record: RawProviderServiceAreaRecord; reasons: string[] }>;
  contractRegionsValid: number;
  contractRegionsRejected: Array<{ record: RawProviderContractRegionRecord; reasons: string[] }>;
}

// 依 docs/DATA_MODEL.md 第 29 節。MVP 僅有 Kareocar 一筆，TASK-B-007 明確禁止
// 做 Kareocar backend/database 整合，因此本欄位不對應任何資料表，僅為靜態設定型別。
export type ExternalServiceType = "TRANSPORTATION";
export type ExternalServiceOpenMode = "NEW_TAB";

export interface ExternalService {
  id: string;
  name: string;
  serviceType: ExternalServiceType;
  url: string;
  active: boolean;
}

// 依 docs/API_CONTRACT.md 第 11 節 Response 格式。
export interface ExternalServiceResponse {
  id: string;
  name: string;
  serviceType: ExternalServiceType;
  url: string;
  openMode: ExternalServiceOpenMode;
  notice: string;
}

// ===== Knowledge（TASK-B-008，依 docs/DATA_MODEL.md 第 23-27 節）=====

// KAREO_DRIVE（2026-09-24，D-17）：來源不是政府/法規公告網頁，而是 Jerry 指定資料夾（D-15）的檔案；
// 顯示文字改用 ruleData.issuer（原發布機關），見 ASSESSMENT_RULES §6.4。
export type KnowledgeAuthority = "MOHW" | "LAW" | "TAIPEI_GOV" | "NEW_TAIPEI_GOV" | "KAREO_DRIVE";
export type Jurisdiction = "TAIWAN" | "TAIPEI" | "NEW_TAIPEI";

export interface KnowledgeSource {
  id: string;
  name: string;
  authority: KnowledgeAuthority;
  jurisdiction: Jurisdiction;
  sourceUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeCategory =
  | "ELIGIBILITY"
  | "BENEFIT"
  | "COPAY"
  | "ASSISTIVE_DEVICE"
  | "TRANSPORTATION"
  | "RESPITE"
  | "HOME_CARE"
  | "HOME_MEDICAL_NURSING"
  | "APPLICATION"
  | "OTHER";

export type KnowledgeRecordStatus =
  | "DISCOVERED"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "SUPERSEDED"
  | "CONFLICT"
  | "FETCH_FAILED";

export interface KnowledgeRecord {
  id: string;
  sourceId: string;
  title: string;
  category: KnowledgeCategory;
  jurisdiction: Jurisdiction;
  sourceUrl: string;
  publishedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  fetchedAt: string;
  lastVerifiedAt: string;
  contentHash: string; // 來源 PDF／網頁的原始雜湊（source.contentHash），不是審核內容指紋，見 contentFingerprint。
  status: KnowledgeRecordStatus;
  version: string | null; // 所屬 KnowledgeVersion.id，PUBLISHED/SUPERSEDED 時才有值
  rawText: string;
  summary: string;
  ruleData: Record<string, unknown>;
  // Jerry 委託修正第二輪（2026-09-27）：獨立於 contentHash 之外的「審核內容指紋」，涵蓋所有會影響
  // 政策解讀／輸出的欄位（見 services/contentFingerprint.ts），由伺服器端從實際保存的欄位重新計算，
  // 不信任輸入自報的雜湊。同一來源（contentHash 不變）仍可能對應不同的審核內容（不同 summary／
  // ruleData），核准與匯入的冪等判斷都必須用這個欄位，不能只看 contentHash。
  contentFingerprint: string;
  createdAt: string;
  updatedAt: string;
  // 依 contracts/knowledge/content-pack.schema.json，來源內容包的追溯資訊（不在 DATA_MODEL 核心欄位內，
  // 但 README §3 要求以 (packId, recordId) 冪等，需要保存才能判斷重複匯入）。
  packId: string;
  packRecordId: string;
}

export type KnowledgeVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface KnowledgeVersion {
  id: string; // 例如 KB-2026-09-26-001
  status: KnowledgeVersionStatus;
  publishedAt: string | null;
  createdBy: string;
  approvedBy: string | null;
  notes: string | null;
  // migration 0007 欄位，TASK-B-012 之前沒有任何呼叫端需要區分「一般發布造成的 ARCHIVED（被取代）」
  // 跟「操作者主動撤回造成的 ARCHIVED」，故未曝露於此型別。B-012 的可恢復版本清單
  // （API_CONTRACT §26.10）需要這個區分：曾被撤回的版本不得再被選為恢復目標。
  withdrawnAt: string | null;
  withdrawnBy: string | null;
  withdrawalReason: string | null;
}

// DISMISSED（v0.2.3，D-16a）：管理頁確認「來源有變但不影響已審核內容」，見 API_CONTRACT §26.7。
export type KnowledgeChangeStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "CONFLICT" | "DISMISSED";

export interface KnowledgeChange {
  id: string;
  knowledgeRecordId: string;
  oldContentHash: string | null;
  newContentHash: string;
  oldContent: string | null;
  newContent: string;
  aiSummary: string | null;
  status: KnowledgeChangeStatus;
  detectedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

// 依 docs/DATA_MODEL.md 第 28 節（TASK-B-009）。
export type CrawlerRunStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";

export interface CrawlerRun {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  status: CrawlerRunStatus;
  itemsChecked: number;
  changesDetected: number;
  // B-009-r2：本次抓取用來比對的雜湊（PDF 為原始位元組雜湊，文字來源為正規化文字雜湊），
  // 即使沒有偵測到變更也保留，供稽核追溯「當天到底看到了什麼」；FAILED 時為 null（沒有算出雜湊）。
  contentHash: string | null;
  // Jerry 委託修正第二輪（2026-09-27）：關聯到這次抓取實際存下的原始快照（見 CrawlerSnapshot），
  // 供稽核從一筆 CrawlerRun 直接找到當時的完整原始內容，不是只有雜湊。抓取失敗時沒有位元組可存，
  // 為 null。
  snapshotId: string | null;
  errorMessage: string | null;
}

// Jerry 委託修正第二輪（2026-09-27）：每次成功抓取的原始快照，掛在 knowledge_sources（一律存在），
// 不掛在 knowledge_records（可能還沒有）——來源尚無 KnowledgeRecord 時仍能保存快照、追蹤變更。
// rawHash／normalizedHash 分開記錄，比對時只能用相同表示法互相比較，不得混用
// （docs/knowledge/source-registry.md 對不同來源記錄的基準雜湊表示法不一致，見 crawlerService.ts）。
export interface CrawlerSnapshot {
  id: string;
  sourceId: string;
  crawlerRunId: string;
  fetchedAt: string;
  contentType: string | null;
  rawBytes: Uint8Array;
  rawHash: string;
  normalizedHash: string | null; // PDF／無法正文抽取時為 null，不假裝有做抽取。
  extractionMethodVersion: string;
  createdAt: string;
}

// 依 docs/API_CONTRACT.md 第 13 節。
export interface KnowledgeStatusResponse {
  version: string;
  publishedAt: string;
  lastVerifiedAt: string;
  notice: string;
}

// ===== TASK-B-014：GET /api/v1/knowledge/records（依 API_CONTRACT §13a，v0.6）=====

// Repository 內部傳遞用：比 KnowledgeSnapshotRecord（Assessment 專用）多了公開回應需要的欄位
// （sourceUrl／sourceName／publishedAt／lastVerifiedAt），刻意不擴充 KnowledgeSnapshotRecord 本身，
// 避免影響 Assessment 既有的知識快照邏輯。issuer 僅供內部算出 source.publisher 用（KAREO_DRIVE
// 來源），絕不可出現在回應裡。
export interface PublicKnowledgeSnapshotRecord {
  id: string;
  title: string;
  category: KnowledgeCategory;
  jurisdiction: Jurisdiction;
  summary: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  publishedAt: string | null; // 官方公告日（DATA_MODEL §24），不是 Kareo 發布時間
  lastVerifiedAt: string;
  sourceUrl: string;
  sourceName: string;
  authority: KnowledgeAuthority | null;
  issuer: string | null; // ruleData.issuer（僅 KAREO_DRIVE 來源使用）
}

export interface PublicKnowledgeSource {
  title: string;
  publisher: string;
  url: string | null;
}

export interface PublicKnowledgeRecordItem {
  id: string;
  title: string;
  category: KnowledgeCategory;
  jurisdiction: Jurisdiction;
  summary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  publishedAt: string | null;
  lastVerifiedAt: string;
  source: PublicKnowledgeSource;
}

export interface KnowledgeRecordsAppliedFilters {
  jurisdiction: Jurisdiction | null;
  category: KnowledgeCategory | null;
  page: number;
  pageSize: number;
}

export interface KnowledgeRecordsResponse {
  knowledgeVersion: string;
  publishedAt: string; // KnowledgeVersion.publishedAt（Kareo 這次發布的時間）
  items: PublicKnowledgeRecordItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  appliedFilters: KnowledgeRecordsAppliedFilters;
  notice: string;
}

// ===== Content Pack Import（依 contracts/knowledge/content-pack.schema.json v1.0）=====

export interface RawContentPackSourceRef {
  sourceId?: unknown;
  authority?: unknown;
  url?: unknown;
  fetchedAt?: unknown;
  contentHash?: unknown;
}

export interface RawContentPackReview {
  reviewedBy?: unknown;
  reviewedAt?: unknown;
  decision?: unknown;
  notes?: unknown;
}

export interface RawContentPackRecord {
  recordId?: unknown;
  category?: unknown;
  jurisdiction?: unknown;
  title?: unknown;
  source?: unknown;
  publishedAt?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  lastVerifiedAt?: unknown;
  excerpt?: unknown;
  summary?: unknown;
  ruleData?: unknown;
  status?: unknown;
  review?: unknown;
}

export interface RawContentPack {
  packId?: unknown;
  formatVersion?: unknown;
  createdAt?: unknown;
  createdBy?: unknown;
  sourceRegistryVersion?: unknown;
  status?: unknown;
  review?: unknown;
  intendedKnowledgeVersion?: unknown;
  records?: unknown;
}

// ===== Lead（TASK-B-006，依 docs/DATA_MODEL.md 第 22、36-38 節）=====

export type LeadStatus = "NEW" | "CONTACTED" | "ACCEPTED" | "CLOSED" | "CANCELLED";

export interface Lead {
  id: string;
  sessionId: string;
  assessmentId: string;
  recommendationId: string;
  providerId: string;
  serviceType: ProviderServiceType;
  // 刪除或保存期限到期時清空為 null（PRIVACY_AND_RETENTION §6），Lead 其餘欄位保留。
  contactName: string | null;
  contactPhone: string | null;
  contactConsentAt: string;
  idempotencyKey: string;
  status: LeadStatus;
  statusReason: string | null;
  assignedOperatorId: string | null;
  firstContactedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 依 docs/API_CONTRACT.md 第 12 節 POST /api/v1/leads Request Body。
export interface CreateLeadInput {
  sessionId: string;
  assessmentId: string;
  recommendationId: string;
  providerId: string;
  serviceType: ProviderServiceType;
  contact: { name: string; phone: string };
  contactConsent: boolean;
}

export interface CreateLeadResult {
  leadId: string;
  status: LeadStatus;
  createdAt: string;
  duplicate: boolean;
}

export type InternalOperatorRole = "LEAD_OPERATOR" | "DATA_STEWARD" | "KNOWLEDGE_PUBLISHER";

export interface InternalOperator {
  id: string;
  displayName: string;
  roles: InternalOperatorRole[];
  keyHash: string;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
}

// `note` 不得包含姓名、電話或健康細節（DATA_MODEL §37）。
// operatorId 為 null：代表系統自動觸發（TASK-B-011b 的同意撤回／使用者刪除資料造成的 Lead 取消，
// 不是真人操作者所為，依 LEAD_OPERATIONS §2「不使用共用帳號」不虛構一個系統操作者帳號頂替）。
export interface LeadStatusEvent {
  id: string;
  leadId: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  reasonCode: string | null;
  note: string | null;
  operatorId: string | null;
  createdAt: string;
}

export type LeadAccessAction = "REVEAL_CONTACT";

export interface LeadAccessEvent {
  id: string;
  leadId: string;
  operatorId: string;
  action: LeadAccessAction;
  createdAt: string;
}

// TASK-B-011b：ARCHITECTURE §20.4 持久化限流（DATA_MODEL §39）。
export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number | null;
}

// TASK-B-011b：DATA_MODEL §40。保存期限到期清理作業的執行紀錄。
export type DeletionRunStatus = "RUNNING" | "SUCCESS" | "FAILED";

// 2026-10-03（Jerry D-05 確認四條保存期限定案後新增 leadsDeleted／consentsDeleted，見
// migration 0019_security_acceptance.sql 的 deletion_runs 表註解）。
export interface DeletionRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  dryRun: boolean;
  status: DeletionRunStatus;
  sessionsDeleted: number;
  leadsContactCleared: number;
  leadsDeleted: number;
  consentsDeleted: number;
  errorMessage: string | null;
  operatorId: string | null;
}

export type KnowledgeImportMode = "commit" | "dry-run";

export interface ContentPackImportReport {
  mode: KnowledgeImportMode;
  written: boolean;
  packId: string | null;
  recordsValid: number;
  recordsRejected: Array<{ recordId: string | null; reasons: string[] }>;
}

// ===== Admin Knowledge Review（TASK-B-012，依 docs/API_CONTRACT.md §26、docs/DATA_MODEL.md 第 41 節）=====

// 15 分鐘管理 token，只存雜湊；跟 §3.1 的一般使用者 Session Token 是分開的憑證體系
// （ARCHITECTURE §20.8、API_CONTRACT §26.1），沒有 lastSeenAt／閒置延長的概念。
export interface AdminSession {
  id: string;
  operatorId: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreatedAdminSession extends AdminSession {
  adminToken: string;
}

export type AdminAuditAction =
  | "KNOWLEDGE_RECORD_APPROVED"
  | "KNOWLEDGE_RECORD_REJECTED"
  | "KNOWLEDGE_CHANGE_DISMISSED"
  | "KNOWLEDGE_VERSION_PUBLISHED"
  | "KNOWLEDGE_VERSION_WITHDRAWN";

export type AdminAuditTargetType = "KNOWLEDGE_RECORD" | "KNOWLEDGE_CHANGE" | "KNOWLEDGE_VERSION";

export interface AdminAuditEvent {
  id: string;
  operatorId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  reason: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

// 依 API_CONTRACT §26.3。
export interface AdminKnowledgeStatus {
  publishedVersion: string | null;
  publishedAt: string | null;
  lastCrawlerRun: { status: CrawlerRunStatus; startedAt: string; finishedAt: string | null } | null;
}

// 依 API_CONTRACT §26.4。
export interface AdminKnowledgeChangeSummary {
  id: string;
  sourceId: string;
  detectedAt: string;
  previousHash: string | null;
  currentHash: string;
  diffSummary: string;
  status: KnowledgeChangeStatus;
}

// 依 API_CONTRACT §26.5。
export interface AdminKnowledgeRecordSummary {
  id: string;
  packId: string;
  recordId: string;
  title: string;
  jurisdiction: Jurisdiction;
  category: KnowledgeCategory;
  sourceUrl: string;
  summary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  contentFingerprint: string;
  status: KnowledgeRecordStatus;
}

export interface AdminReviewInfo {
  decision: "APPROVED" | "REJECTED" | "DISMISSED";
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
}

// 依 API_CONTRACT §26.10。
export interface RestorableVersionSummary {
  versionId: string;
  publishedAt: string;
  approvedBy: string | null;
  notes: string | null;
  recordCount: number;
}

export interface RestorableVersionsResponse {
  currentVersion: { versionId: string; publishedAt: string; recordCount: number } | null;
  versions: RestorableVersionSummary[];
}

// 依 API_CONTRACT §26.11。
export interface AdminWithdrawResult {
  withdrawnVersionId: string;
  republishedVersionId: string | null;
  withdrawnAt: string;
  withdrawnBy: string;
  reason: string;
}

// ===== 內容包持久化（TASK-B-012-r3，Jerry 2026-10-01 指示 2）=====

export type ContentPackStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED";

// DATA_MODEL §26b：內容包層級的核准與匯入證據都要持久化，不能只信 status 字串。
// recordsFingerprint 是本表額外欄位（§26b「至少包含」），只含逐筆內容，用來判斷同一 packId 內容是否改變。
export interface ContentPack {
  id: string;
  formatVersion: string;
  intendedKnowledgeVersion: string | null;
  sourceRegistryVersion: string | null;
  status: ContentPackStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewDecision: string | null;
  packFingerprint: string;
  recordsFingerprint: string;
  importedAt: string;
  importedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPackUpsertInput {
  packId: string;
  formatVersion: string;
  intendedKnowledgeVersion: string | null;
  sourceRegistryVersion: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewDecision: string | null;
  packFingerprint: string;
  recordsFingerprint: string;
  importedBy: string;
}

// 同一 packId 重新登錄時的結果（同 migration 0020 upsert_content_pack 的回傳）。
export type ContentPackUpsertAction = "inserted" | "promoted" | "unchanged";

export type KnowledgeRecordReviewSource = "CLI_PACK" | "ADMIN_API";

// 逐筆審核證據：CLI（approveKnowledgePack）與管理頁核准共用，只能新增。
export interface KnowledgeRecordReviewEvent {
  id: string;
  knowledgeRecordId: string;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  reviewedBy: string;
  reviewedAt: string;
  contentFingerprint: string;
  source: KnowledgeRecordReviewSource;
  createdAt: string;
}

export type PublishPlanBlockerCode =
  | "NO_APPROVED_RECORDS"
  | "ALL_CANDIDATES_EXPIRED"
  | "PACK_NOT_APPROVED"
  | "TARGET_VERSION_INVALID"
  | "TARGET_VERSION_CONFLICT"
  | "VERSION_ALREADY_EXISTS";

export interface PublishPlanBlocker {
  code: PublishPlanBlockerCode;
  message: string;
}

export interface PublishPlanNewRecord {
  id: string;
  packId: string;
  recordId: string;
  title: string;
  jurisdiction: Jurisdiction;
  effectiveFrom: string;
  effectiveTo: string | null;
}

// 依 API_CONTRACT §26.8，由 public.compute_publish_plan() 算出（預覽與發布共用同一套計算）。
export interface PublishPlan {
  canPublish: boolean;
  targetVersionId: string | null;
  currentVersionId: string | null;
  publishDate: string;
  publishedRecordCount: number;
  carriedForwardCount: number;
  totalRecordCount: number;
  supersededRecordCount: number;
  excludedRecordCount: number;
  newRecords: PublishPlanNewRecord[];
  blockers: PublishPlanBlocker[];
  previewToken: string | null;
  generatedAt: string;
}

// 依 API_CONTRACT §26.9。
export interface AdminPublishResult {
  versionId: string;
  publishedAt: string;
  publishedRecordCount: number;
  carriedForwardCount: number;
  totalRecordCount: number;
  supersededRecordCount: number;
  excludedRecordCount: number;
}
