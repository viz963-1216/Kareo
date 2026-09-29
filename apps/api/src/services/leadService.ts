import type {
  AssessmentRepository,
  ConsentRepository,
  LeadRepository,
  RecommendationRepository,
  SessionRepository,
} from "../repositories/types.js";
import type { CreateLeadInput, CreateLeadResult, Lead, ProviderServiceType } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import { requireIdempotencyKey } from "../lib/idempotencyKey.js";
import { requireMatchingSessionId, requireOwnedResource, requireValidSession } from "./sessionSecurityService.js";

const SERVICE_TYPES: ProviderServiceType[] = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"];
// 依 ARCHITECTURE §20.4：臺灣手機 09\d{8} 或市話 0\d{1,2}-?\d{6,8}。
const PHONE_PATTERN = /^(09\d{8}|0\d{1,2}-?\d{6,8})$/;

export interface LeadServiceDeps {
  sessionRepo: SessionRepository;
  consentRepo: ConsentRepository;
  assessmentRepo: AssessmentRepository;
  recommendationRepo: RecommendationRepository;
  leadRepo: LeadRepository;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 30;
}

function isValidPhone(value: unknown): value is string {
  return typeof value === "string" && PHONE_PATTERN.test(value);
}

function parseInput(body: unknown): CreateLeadInput {
  if (typeof body !== "object" || body === null) {
    throw new AppError("INVALID_REQUEST", "請求格式錯誤。");
  }
  const input = body as Record<string, unknown>;

  if (!isNonEmptyString(input.sessionId)) throw new AppError("VALIDATION_ERROR", "缺少有效的 sessionId。");
  if (!isNonEmptyString(input.assessmentId)) throw new AppError("VALIDATION_ERROR", "缺少有效的 assessmentId。");
  if (!isNonEmptyString(input.recommendationId)) throw new AppError("VALIDATION_ERROR", "缺少有效的 recommendationId。");
  if (!isNonEmptyString(input.providerId)) throw new AppError("VALIDATION_ERROR", "缺少有效的 providerId。");
  if (!isOneOf(input.serviceType, SERVICE_TYPES)) throw new AppError("VALIDATION_ERROR", "serviceType 不合法。");
  if (input.contactConsent !== true) throw new AppError("VALIDATION_ERROR", "必須同意媒合聯絡才能送出。");

  const contact = input.contact;
  if (typeof contact !== "object" || contact === null) {
    throw new AppError("VALIDATION_ERROR", "缺少聯絡資料。");
  }
  const contactRecord = contact as Record<string, unknown>;
  if (!isValidName(contactRecord.name)) throw new AppError("VALIDATION_ERROR", "聯絡稱呼格式錯誤（1–30 字）。");
  if (!isValidPhone(contactRecord.phone)) throw new AppError("VALIDATION_ERROR", "聯絡電話格式錯誤。");

  return {
    sessionId: input.sessionId,
    assessmentId: input.assessmentId,
    recommendationId: input.recommendationId,
    providerId: input.providerId,
    serviceType: input.serviceType,
    contact: { name: contactRecord.name.trim(), phone: contactRecord.phone },
    contactConsent: true,
  };
}

// 同一 idempotencyKey 重送是否視為「相同內容」：比對會影響媒合結果與聯絡對象的欄位
// （API_CONTRACT §3.3：內容不同 → IDEMPOTENCY_CONFLICT）。
function sameContent(existing: Lead, input: CreateLeadInput): boolean {
  return (
    existing.assessmentId === input.assessmentId &&
    existing.recommendationId === input.recommendationId &&
    existing.providerId === input.providerId &&
    existing.serviceType === input.serviceType &&
    existing.contactName === input.contact.name &&
    existing.contactPhone === input.contact.phone
  );
}

function toResult(lead: Lead, duplicate: boolean): CreateLeadResult {
  return { leadId: lead.id, status: lead.status, createdAt: lead.createdAt, duplicate };
}

// 依 tasks/TASK-B-006.md + docs/API_CONTRACT.md 第 12 節：POST /api/v1/leads。
export async function createLead(
  deps: LeadServiceDeps,
  body: unknown,
  sessionTokenHeader: unknown,
  idempotencyKeyHeader: unknown
): Promise<CreateLeadResult> {
  const session = await requireValidSession(deps.sessionRepo, sessionTokenHeader);
  const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
  const input = parseInput(body);
  requireMatchingSessionId(session, input.sessionId);

  // ARCHITECTURE §20.3 第 3 步：Lead 屬於需要同意的操作，同意可能在 Assessment 之後被撤回。
  const consent = await deps.consentRepo.findLatestBySession(session.id);
  if (!consent) throw new AppError("CONSENT_REQUIRED", "請先完成服務說明與免責聲明同意。");

  // 冪等重送：同一 (session, key) 已有 Lead，內容相同回原結果，不同回 IDEMPOTENCY_CONFLICT，
  // 兩種情況都不需要重新驗證歸屬（已在建立當下驗證過）。
  const existingByKey = await deps.leadRepo.findBySessionAndIdempotencyKey(session.id, idempotencyKey);
  if (existingByKey) {
    if (!sameContent(existingByKey, input)) {
      throw new AppError("IDEMPOTENCY_CONFLICT", "同一 Idempotency-Key 但內容不同。");
    }
    return toResult(existingByKey, false);
  }

  const assessment = await deps.assessmentRepo.findById(input.assessmentId);
  if (!assessment) throw new AppError("NOT_FOUND", "找不到指定的評估結果。");
  requireOwnedResource(assessment.sessionId, session, "找不到指定的評估結果。");

  const runWithItems = await deps.recommendationRepo.findRunWithItems(input.recommendationId);
  if (!runWithItems) throw new AppError("NOT_FOUND", "找不到指定的推薦結果。");
  // recommendationId 屬於同一 session：透過其 assessmentId 反查（RecommendationRun 本身沒有 sessionId）。
  if (runWithItems.run.assessmentId !== assessment.id) {
    throw new AppError("NOT_FOUND", "找不到指定的推薦結果。");
  }
  if (runWithItems.run.serviceType !== input.serviceType) {
    throw new AppError("VALIDATION_ERROR", "serviceType 與推薦結果不符。");
  }
  const providerInRun = runWithItems.items.some((item) => item.providerId === input.providerId);
  if (!providerInRun) {
    throw new AppError("VALIDATION_ERROR", "providerId 不在該推薦結果中。");
  }

  // 業務重複：同一 session+provider+serviceType 已有未終態 Lead → 回既有 Lead，不新增。
  const existingOpen = await deps.leadRepo.findOpenBySessionProviderService(
    session.id,
    input.providerId,
    input.serviceType
  );
  if (existingOpen) return toResult(existingOpen, true);

  const now = nowTaipeiISOString();
  const lead: Lead = {
    id: generateId("LEAD"),
    sessionId: session.id,
    assessmentId: assessment.id,
    recommendationId: runWithItems.run.id,
    providerId: input.providerId,
    serviceType: input.serviceType,
    contactName: input.contact.name,
    contactPhone: input.contact.phone,
    contactConsentAt: now,
    idempotencyKey,
    status: "NEW",
    statusReason: null,
    assignedOperatorId: null,
    firstContactedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const { inserted } = await deps.leadRepo.insertLead(lead);
  if (inserted) return toResult(lead, false);

  // 併發競態：insertLead 因唯一約束失敗，代表另一個請求剛好搶先寫入；重新查詢兩種可能情境，
  // 不把資料庫層的衝突原文往外拋（ARCHITECTURE §20.5）。
  const raceByKey = await deps.leadRepo.findBySessionAndIdempotencyKey(session.id, idempotencyKey);
  if (raceByKey) {
    if (!sameContent(raceByKey, input)) {
      throw new AppError("IDEMPOTENCY_CONFLICT", "同一 Idempotency-Key 但內容不同。");
    }
    return toResult(raceByKey, false);
  }
  const raceOpen = await deps.leadRepo.findOpenBySessionProviderService(session.id, input.providerId, input.serviceType);
  if (raceOpen) return toResult(raceOpen, true);

  throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。");
}
