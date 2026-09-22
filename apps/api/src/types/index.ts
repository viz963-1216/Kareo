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
