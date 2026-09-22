import type { AssessmentRepository, ConsentRepository, SessionRepository } from "../repositories/types.js";
import type { CareAssessmentAIAdapter } from "../adapters/aiAdapter.js";
import type { PublishedKnowledgeVersionResolver } from "../adapters/knowledgeVersionResolver.js";
import type {
  AgeRange,
  Assessment,
  AssessmentLocationInput,
  AssessmentNeedsInput,
  CareNeedProfile,
  CaregiverSituation,
  CreateAssessmentInput,
  DailyLivingLevel,
  LivingSituation,
  LocationPrecision,
  MobilityLevel,
  ServiceNeed,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";

export interface AssessmentServiceDeps {
  sessionRepo: SessionRepository;
  consentRepo: ConsentRepository;
  assessmentRepo: AssessmentRepository;
  aiAdapter: CareAssessmentAIAdapter;
  knowledgeVersionResolver: PublishedKnowledgeVersionResolver;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || value === undefined || typeof value === "number";
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

  const location = input.location as Record<string, unknown> | undefined;
  if (typeof location !== "object" || location === null) {
    throw new AppError("VALIDATION_ERROR", "缺少 location。");
  }
  if (!isNonEmptyString(location.city)) {
    throw new AppError("VALIDATION_ERROR", "缺少 location.city。");
  }
  if (!isNonEmptyString(location.district)) {
    throw new AppError("VALIDATION_ERROR", "缺少 location.district。");
  }
  if (!isOneOf(location.precision, LOCATION_PRECISIONS)) {
    throw new AppError("VALIDATION_ERROR", "location.precision 不合法。");
  }
  if (!isNullableNumber(location.lat) || !isNullableNumber(location.lng)) {
    throw new AppError("VALIDATION_ERROR", "location.lat / location.lng 格式不合法。");
  }

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

  if (typeof input.freeText !== "string") {
    throw new AppError("VALIDATION_ERROR", "freeText 格式不合法。");
  }

  return {
    sessionId: input.sessionId,
    ageRange: input.ageRange,
    location: location as unknown as AssessmentLocationInput,
    livingSituation: input.livingSituation,
    caregiverSituation: input.caregiverSituation,
    mobilityLevel: input.mobilityLevel,
    dailyLivingLevel: input.dailyLivingLevel,
    needs: needs as unknown as AssessmentNeedsInput,
    freeText: input.freeText,
  };
}

// Consent Gate：依 tasks/TASK-B-003.md，沒有 Session 或沒有有效 Consent 一律 CONSENT_REQUIRED。
// Consent 記錄只在 accepted=true 時才會被建立（見 consentService），
// 因此「找得到 Consent」即代表已完成有效同意，不需要額外的 accepted 欄位判斷。
async function requireValidConsent(
  sessionRepo: SessionRepository,
  consentRepo: ConsentRepository,
  sessionId: string
): Promise<void> {
  const sessionExists = await sessionRepo.exists(sessionId);
  if (!sessionExists) {
    throw new AppError("CONSENT_REQUIRED", "請先建立 Session 並完成同意流程。");
  }

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
  body: unknown
): Promise<CreateAssessmentResult> {
  // 依 tasks/TASK-B-003.md 流程：Valid Session -> Valid Consent Gate -> Assessment Input Validation。
  // 先只取出 sessionId 確認 Consent Gate，再進行完整欄位驗證，避免在確認使用者已同意前，
  // 就先深入解析/驗證整份 Assessment 內容。
  const sessionId = extractSessionId(body);
  await requireValidConsent(deps.sessionRepo, deps.consentRepo, sessionId);

  const input = validateCreateAssessmentInput(body);

  const knowledgeVersion = await deps.knowledgeVersionResolver.resolvePublishedVersion();
  if (!knowledgeVersion) {
    throw new AppError(
      "KNOWLEDGE_UNAVAILABLE",
      "目前平台資料不足以做出可靠預估，建議聯絡 1966 或所在地長期照顧管理中心確認。"
    );
  }

  // 依 tasks/TASK-B-003.md「AI Adapter Rule」：Adapter 只產生 CareNeedProfile，不得選 / 排 Provider。
  const draft = await deps.aiAdapter.generateCareNeedProfile(input);

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
      homeCareNeed: input.needs.homeCare,
      medicalNursingNeed: input.needs.medicalNursing,
      assistiveDeviceNeed: input.needs.assistiveDevice,
      transportationNeed: input.needs.transportation,
      freeText: input.freeText,
      status: "COMPLETED",
      knowledgeVersion,
    },
    careNeedProfile: {
      careNeeds: draft.careNeeds,
      priority: draft.priority,
      summary: draft.summary,
      warnings: draft.warnings,
    },
  });

  return { assessment, careNeedProfile };
}
