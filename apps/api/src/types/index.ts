// 依 docs/DATA_MODEL.md 第 4、6 節。欄位/型態不得自行新增或修改。

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Consent {
  id: string;
  sessionId: string;
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  acceptedAt: string;
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
