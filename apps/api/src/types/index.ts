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

export interface AssessmentLocationInput {
  city: string;
  district: string;
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
  freeText: string;
}

// 依 docs/DATA_MODEL.md 第 7 節。
export interface Assessment {
  id: string;
  sessionId: string;
  ageRange: AgeRange;
  city: string;
  district: string;
  locationPrecision: LocationPrecision;
  lat: number | null;
  lng: number | null;
  livingSituation: LivingSituation;
  caregiverSituation: CaregiverSituation;
  mobilityLevel: MobilityLevel;
  dailyLivingLevel: DailyLivingLevel;
  homeCareNeed: ServiceNeed;
  medicalNursingNeed: ServiceNeed;
  assistiveDeviceNeed: ServiceNeed;
  transportationNeed: ServiceNeed;
  freeText: string;
  status: AssessmentStatus;
  knowledgeVersion: string;
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

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
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

// 依 docs/API_CONTRACT.md 第 10 節 GET /api/v1/providers/{providerId} Response。
export interface ProviderDetailResponse {
  id: string;
  name: string;
  type: ProviderType;
  address: string;
  city: string;
  district: string;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  verified: boolean;
  services: ProviderServiceType[];
  serviceAreas: Array<{ city: string; district: string }>;
}

// TASK-B-004 Import 用：A 提供的 staging dataset 原始（未驗證）格式。
// 欄位刻意設為寬鬆 unknown/optional，因為來源資料可能缺欄位（例如 provider-services
// 目前缺 id/active），必須先驗證才能決定是否匯入，不得自行猜值。
export interface RawProviderRecord {
  id?: unknown;
  name?: unknown;
  type?: unknown;
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

export interface ProviderImportDataset {
  providers: RawProviderRecord[];
  providerServices: RawProviderServiceRecord[];
  providerServiceAreas: RawProviderServiceAreaRecord[];
}

// commit：正式匯入，任何一筆拒收則整批不寫入。dry-run：只驗證與產生報告，永不寫入。
// 刻意不提供「部分接受並寫入」模式，避免誤用成正式 gate。
export type ProviderImportMode = "commit" | "dry-run";

export interface ProviderImportReport {
  mode: ProviderImportMode;
  written: boolean;
  // 只有 commit 模式且寫入成功時才有值；數字來自資料庫交易實際寫入的筆數。
  writtenCounts: { providers: number; providerServices: number; providerServiceAreas: number } | null;
  providersValid: number;
  providersRejected: Array<{ record: RawProviderRecord; reasons: string[] }>;
  servicesValid: number;
  servicesRejected: Array<{ record: RawProviderServiceRecord; reasons: string[] }>;
  serviceAreasValid: number;
  serviceAreasRejected: Array<{ record: RawProviderServiceAreaRecord; reasons: string[] }>;
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

export type KnowledgeAuthority = "MOHW" | "LAW" | "TAIPEI_GOV" | "NEW_TAIPEI_GOV";
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
  contentHash: string;
  status: KnowledgeRecordStatus;
  version: string | null; // 所屬 KnowledgeVersion.id，PUBLISHED/SUPERSEDED 時才有值
  rawText: string;
  summary: string;
  ruleData: Record<string, unknown>;
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
}

export type KnowledgeChangeStatus = "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "CONFLICT";

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
  errorMessage: string | null;
}

// 依 docs/API_CONTRACT.md 第 13 節。
export interface KnowledgeStatusResponse {
  version: string;
  publishedAt: string;
  lastVerifiedAt: string;
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

export type KnowledgeImportMode = "commit" | "dry-run";

export interface ContentPackImportReport {
  mode: KnowledgeImportMode;
  written: boolean;
  packId: string | null;
  recordsValid: number;
  recordsRejected: Array<{ recordId: string | null; reasons: string[] }>;
}
