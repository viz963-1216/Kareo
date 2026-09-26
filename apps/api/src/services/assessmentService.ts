import type { AssessmentRepository, ConsentRepository, SessionRepository } from "../repositories/types.js";
import { requireMatchingSessionId, requireValidSession } from "./sessionSecurityService.js";
import type { CareAssessmentAIAdapter } from "../adapters/aiAdapter.js";
import type { PublishedKnowledgeResolver } from "../adapters/knowledgeVersionResolver.js";
import type { KnowledgeSnapshot } from "../assessment/knowledgeSnapshot.js";
import { taipeiDate } from "../assessment/knowledgeSnapshot.js";
import { CITY_JURISDICTION } from "../assessment/rules.js";
import type {
  AgeRange,
  Assessment,
  AssessmentLocationInput,
  AssessmentNeedsInput,
  CareNeedProfile,
  CaregiverSituation,
  CreateAssessmentInput,
  DailyLivingLevel,
  DisabilityCertificate,
  IncomeCategory,
  LivingSituation,
  LocationPrecision,
  MobilityLevel,
  ServiceNeed,
} from "../types/index.js";
import { AppError, KNOWLEDGE_UNAVAILABLE_MESSAGE } from "../errors/AppError.js";

export interface AssessmentServiceDeps {
  sessionRepo: SessionRepository;
  consentRepo: ConsentRepository;
  assessmentRepo: AssessmentRepository;
  aiAdapter: CareAssessmentAIAdapter; // 正式環境為 RuleBasedAssessmentEngine（介面名稱沿用 B-003）
  knowledgeResolver: PublishedKnowledgeResolver;
  now?: () => Date;
  // 只接收不含使用者資料的事件（不含 freeText、座標、token、資料庫錯誤原文）。
  log?: (event: Record<string, string>) => void;
}

function defaultLog(event: Record<string, string>): void {
  console.warn(JSON.stringify({ scope: "assessment", ...event }));
}

const AGE_RANGES: AgeRange[] = ["UNDER_50", "50_64", "65_74", "75_84", "85_PLUS", "UNKNOWN"];
const LOCATION_PRECISIONS: LocationPrecision[] = ["NONE", "CITY", "DISTRICT", "EXACT", "GPS"];
const LIVING_SITUATIONS: LivingSituation[] = [
  "ALONE",
  "WITH_FAMILY",
  "WITH_CAREGIVER",
  "INSTITUTION",
  "OTHER",
  "UNKNOWN",
];
const CAREGIVER_SITUATIONS: CaregiverSituation[] = [
  "NO_CAREGIVER",
  "FAMILY_AVAILABLE",
  "FAMILY_LIMITED",
  "PAID_CAREGIVER",
  "OTHER",
  "UNKNOWN",
];
const MOBILITY_LEVELS: MobilityLevel[] = ["INDEPENDENT", "NEEDS_ASSISTANCE", "WHEELCHAIR", "BEDRIDDEN", "UNKNOWN"];
const DAILY_LIVING_LEVELS: DailyLivingLevel[] = [
  "INDEPENDENT",
  "PARTIAL_ASSISTANCE",
  "HIGH_ASSISTANCE",
  "FULL_ASSISTANCE",
  "UNKNOWN",
];
const SERVICE_NEEDS: ServiceNeed[] = ["YES", "NO", "UNKNOWN"];
// API_CONTRACT v0.3.1／v0.3.2（D-17／D-17a）：選填，未提供時視為 UNKNOWN（向下相容），其他值 VALIDATION_ERROR。
const DISABILITY_CERTIFICATES: DisabilityCertificate[] = ["YES", "NO", "UNKNOWN"];
const INCOME_CATEGORIES: IncomeCategory[] = ["LOW_INCOME", "MIDDLE_LOW_INCOME", "ALLOWANCE", "GENERAL", "UNKNOWN"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// 依 API_CONTRACT v0.2.2 §8（J-002-r4）：location 物件一律存在、四個子欄位一律出現（不適用為 null），
// 由 precision 決定必填組合；city 只接受 MVP 服務縣市。NONE／CITY 可以完成評估。
const LOCATION_FIELDS = ["city", "district", "precision", "lat", "lng"] as const;

function validateLocation(value: unknown): AssessmentLocationInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("VALIDATION_ERROR", "缺少 location。");
  }
  const location = value as Record<string, unknown>;
  for (const field of LOCATION_FIELDS) {
    if (!(field in location)) throw new AppError("VALIDATION_ERROR", `缺少 location.${field}。`);
  }
  if (!isOneOf(location.precision, LOCATION_PRECISIONS)) {
    throw new AppError("VALIDATION_ERROR", "location.precision 不合法。");
  }
  const precision = location.precision;
  const { city, district, lat, lng } = location;

  const needsCity = precision !== "NONE";
  const needsDistrict = precision === "DISTRICT" || precision === "GPS" || precision === "EXACT";
  const needsCoordinates = precision === "GPS" || precision === "EXACT";

  if (needsCity) {
    if (typeof city !== "string" || !(city in CITY_JURISDICTION)) {
      throw new AppError("VALIDATION_ERROR", "location.city 不合法。");
    }
  } else if (city !== null) {
    throw new AppError("VALIDATION_ERROR", "location.precision 為 NONE 時 city 必須為 null。");
  }

  if (needsDistrict) {
    if (!isNonEmptyString(district)) throw new AppError("VALIDATION_ERROR", "缺少 location.district。");
  } else if (district !== null) {
    throw new AppError("VALIDATION_ERROR", "location.precision 不需要 district 時必須為 null。");
  }

  if (needsCoordinates) {
    if (!isCoordinate(lat, 90) || !isCoordinate(lng, 180)) {
      throw new AppError("VALIDATION_ERROR", "location.lat / location.lng 格式不合法。");
    }
  } else if (lat !== null || lng !== null) {
    throw new AppError("VALIDATION_ERROR", "location.precision 不需要座標時 lat / lng 必須為 null。");
  }

  return {
    city: needsCity ? (city as string) : null,
    district: needsDistrict ? (district as string).trim() : null,
    precision,
    // D-13e（PROPOSED 建議）：座標寫入前四捨五入到小數 3 位（約 100 公尺）。
    lat: needsCoordinates ? roundCoordinate(lat as number) : null,
    lng: needsCoordinates ? roundCoordinate(lng as number) : null,
  };
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -limit && value <= limit;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// 依 tasks/TASK-B-003.md 流程圖，Consent Gate 必須先於完整欄位驗證執行，
// 這裡只做「找出 sessionId」這個最小前置動作，不做其他欄位檢查。
export function extractSessionId(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new AppError("INVALID_REQUEST", "請求格式錯誤。");
  }
  const input = body as Record<string, unknown>;
  if (!isNonEmptyString(input.sessionId)) {
    throw new AppError("VALIDATION_ERROR", "缺少有效的 sessionId。");
  }
  return input.sessionId;
}

// 依 tasks/TASK-B-003.md「Assessment Validation」逐欄位檢查，不得因為 AI 比較方便就把欄位格式改掉。
export function validateCreateAssessmentInput(body: unknown): CreateAssessmentInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("INVALID_REQUEST", "請求格式錯誤。");
  }
  const input = body as Record<string, unknown>;

  if (!isNonEmptyString(input.sessionId)) {
    throw new AppError("VALIDATION_ERROR", "缺少有效的 sessionId。");
  }
  if (!isOneOf(input.ageRange, AGE_RANGES)) {
    throw new AppError("VALIDATION_ERROR", "ageRange 不合法。");
  }

  const location = validateLocation(input.location);

  if (!isOneOf(input.livingSituation, LIVING_SITUATIONS)) {
    throw new AppError("VALIDATION_ERROR", "livingSituation 不合法。");
  }
  if (!isOneOf(input.caregiverSituation, CAREGIVER_SITUATIONS)) {
    throw new AppError("VALIDATION_ERROR", "caregiverSituation 不合法。");
  }
  if (!isOneOf(input.mobilityLevel, MOBILITY_LEVELS)) {
    throw new AppError("VALIDATION_ERROR", "mobilityLevel 不合法。");
  }
  if (!isOneOf(input.dailyLivingLevel, DAILY_LIVING_LEVELS)) {
    throw new AppError("VALIDATION_ERROR", "dailyLivingLevel 不合法。");
  }

  const needs = input.needs as Record<string, unknown> | undefined;
  if (typeof needs !== "object" || needs === null) {
    throw new AppError("VALIDATION_ERROR", "缺少 needs。");
  }
  if (!isOneOf(needs.homeCare, SERVICE_NEEDS)) {
    throw new AppError("VALIDATION_ERROR", "needs.homeCare 不合法。");
  }
  if (!isOneOf(needs.medicalNursing, SERVICE_NEEDS)) {
    throw new AppError("VALIDATION_ERROR", "needs.medicalNursing 不合法。");
  }
  if (!isOneOf(needs.assistiveDevice, SERVICE_NEEDS)) {
    throw new AppError("VALIDATION_ERROR", "needs.assistiveDevice 不合法。");
  }
  if (!isOneOf(needs.transportation, SERVICE_NEEDS)) {
    throw new AppError("VALIDATION_ERROR", "needs.transportation 不合法。");
  }

  // 選填，未提供時視為 UNKNOWN（向下相容，舊前端不會被拒）；其他值 VALIDATION_ERROR。
  const disabilityCertificate = input.disabilityCertificate ?? "UNKNOWN";
  if (!isOneOf(disabilityCertificate, DISABILITY_CERTIFICATES)) {
    throw new AppError("VALIDATION_ERROR", "disabilityCertificate 不合法。");
  }
  const incomeCategory = input.incomeCategory ?? "UNKNOWN";
  if (!isOneOf(incomeCategory, INCOME_CATEGORIES)) {
    throw new AppError("VALIDATION_ERROR", "incomeCategory 不合法。");
  }

  if (typeof input.freeText !== "string") {
    throw new AppError("VALIDATION_ERROR", "freeText 格式不合法。");
  }

  return {
    sessionId: input.sessionId,
    ageRange: input.ageRange,
    location,
    livingSituation: input.livingSituation,
    caregiverSituation: input.caregiverSituation,
    mobilityLevel: input.mobilityLevel,
    dailyLivingLevel: input.dailyLivingLevel,
    needs: needs as unknown as AssessmentNeedsInput,
    disabilityCertificate,
    incomeCategory,
    freeText: input.freeText,
  };
}

// Consent Gate：依 tasks/TASK-B-003.md，沒有有效 Consent 一律 CONSENT_REQUIRED。
// Session 本身是否有效改由 requireValidSession（TASK-B-011a）在更早的步驟把關，
// 這裡只需確認「這個已驗證過的 session 有沒有仍然有效（withdrawnAt 為空）的 Consent」。
// Consent 記錄只在 accepted=true 時才會被建立（見 consentService），
// 因此「找得到 Consent」即代表已完成有效同意，不需要額外的 accepted 欄位判斷。
async function requireValidConsent(consentRepo: ConsentRepository, sessionId: string): Promise<void> {
  const consent = await consentRepo.findLatestBySession(sessionId);
  if (!consent) {
    throw new AppError("CONSENT_REQUIRED", "請先完成服務說明與免責聲明同意。");
  }
}

export interface CreateAssessmentResult {
  assessment: Assessment;
  careNeedProfile: CareNeedProfile;
}

export async function createAssessment(
  deps: AssessmentServiceDeps,
  body: unknown,
  sessionTokenHeader: unknown
): Promise<CreateAssessmentResult> {
  // 依 tasks/TASK-B-003.md 流程 + TASK-B-011a：
  // Valid Session Token -> Body sessionId 一致 -> Valid Consent Gate -> Assessment Input Validation。
  // 先只取出 sessionId 做輕量檢查，再進行完整欄位驗證，避免在確認使用者身分與同意前，
  // 就先深入解析/驗證整份 Assessment 內容。
  const session = await requireValidSession(deps.sessionRepo, sessionTokenHeader);
  const sessionId = extractSessionId(body);
  requireMatchingSessionId(session, sessionId);
  await requireValidConsent(deps.consentRepo, sessionId);

  const input = validateCreateAssessmentInput(body);

  const log = deps.log ?? defaultLog;

  // ASSESSMENT_RULES §2 步驟 1：本次評估只綁定這一份 PUBLISHED 快照；
  // 無 PUBLISHED 版本、查詢失敗或逾時 → KNOWLEDGE_UNAVAILABLE，不產生結果、不寫入任何資料。
  let knowledge: KnowledgeSnapshot | null;
  try {
    knowledge = await deps.knowledgeResolver.resolvePublishedKnowledge();
  } catch (err) {
    log({ event: "KNOWLEDGE_LOAD_FAILED", reason: err instanceof Error ? err.constructor.name : "Unknown" });
    throw new AppError("KNOWLEDGE_UNAVAILABLE", KNOWLEDGE_UNAVAILABLE_MESSAGE);
  }
  if (!knowledge) {
    throw new AppError("KNOWLEDGE_UNAVAILABLE", KNOWLEDGE_UNAVAILABLE_MESSAGE);
  }

  const today = taipeiDate((deps.now ?? (() => new Date()))());
  const result = await deps.aiAdapter.generateCareNeedProfile(input, { knowledge, today });
  for (const diagnostic of result.diagnostics) log({ ...diagnostic });

  // Assessment 與 CareNeedProfile 在同一個交易內寫入（Repository 保證全有或全無）。
  const { assessment, careNeedProfile } = await deps.assessmentRepo.createAssessment({
    assessment: {
      sessionId: input.sessionId,
      ageRange: input.ageRange,
      city: input.location.city,
      district: input.location.district,
      locationPrecision: input.location.precision,
      lat: input.location.lat,
      lng: input.location.lng,
      livingSituation: input.livingSituation,
      caregiverSituation: input.caregiverSituation,
      mobilityLevel: input.mobilityLevel,
      dailyLivingLevel: input.dailyLivingLevel,
      disabilityCertificate: input.disabilityCertificate,
      incomeCategory: input.incomeCategory,
      homeCareNeed: input.needs.homeCare,
      medicalNursingNeed: input.needs.medicalNursing,
      assistiveDeviceNeed: input.needs.assistiveDevice,
      transportationNeed: input.needs.transportation,
      freeText: input.freeText,
      status: "COMPLETED",
      knowledgeVersion: knowledge.version,
      rulesVersion: result.rulesVersion,
      ruleTrace: result.ruleTrace,
    },
    careNeedProfile: result.profile,
  });

  return { assessment, careNeedProfile };
}
