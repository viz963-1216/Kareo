import { createHash } from "node:crypto";
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

// 同一 idempotencyKey 重送是否視為「相同內容」：比對會影響媒合結果與聯絡對象的欄位，存成
// lead_idempotency_records.request_fingerprint（API_CONTRACT §3.3：內容不同 → IDEMPOTENCY_CONFLICT）。
function computeRequestFingerprint(input: CreateLeadInput): string {
  const canonical = JSON.stringify({
    assessmentId: input.assessmentId,
    recommendationId: input.recommendationId,
    providerId: input.providerId,
    serviceType: input.serviceType,
    contactName: input.contact.name,
    contactPhone: input.contact.phone,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function toResult(lead: Lead, duplicate: boolean): CreateLeadResult {
  return { leadId: lead.id, status: lead.status, createdAt: lead.createdAt, duplicate };
}

// J-003-r8（Jerry 委託審查 #47，問題 3）：解析既有的 lead_idempotency_records 紀錄，決定回原結果
// 還是 IDEMPOTENCY_CONFLICT。抽成共用函式，因為初次解析與併發競態後的重新解析要用同一套邏輯。
async function resolveFromLedger(
  deps: LeadServiceDeps,
  sessionId: string,
  idempotencyKey: string,
  fingerprint: string
): Promise<CreateLeadResult> {
  const record = await deps.leadRepo.findIdempotencyRecord(sessionId, idempotencyKey);
  if (!record) throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。");
  if (record.requestFingerprint !== fingerprint) {
    throw new AppError("IDEMPOTENCY_CONFLICT", "同一 Idempotency-Key 但內容不同。");
  }
  const lead = await deps.leadRepo.findById(record.leadId);
  if (!lead) throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。");
  return toResult(lead, record.duplicate);
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

  const fingerprint = computeRequestFingerprint(input);

  // 冪等重送：同一 (session, key) 已有解析紀錄（不論當初是真的建立新 Lead、還是找到既有的業務
  // 重複 Lead 而回傳它，兩者都會被記錄——J-003-r8 問題 3：先前只有「真的建立新 Lead」的 key 會被
  // 記下來，業務重複分支完全沒有留痕，該 Lead 結案後同一 key 重送會錯誤地建立第二筆 Lead），
  // 內容相同回原結果，不同回 IDEMPOTENCY_CONFLICT，兩種情況都不需要重新驗證歸屬。
  const existingRecord = await deps.leadRepo.findIdempotencyRecord(session.id, idempotencyKey);
  if (existingRecord) {
    return resolveFromLedger(deps, session.id, idempotencyKey, fingerprint);
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

  // 業務重複：同一 session+provider+serviceType 已有未終態 Lead → 回既有 Lead，不新增，但這次
  // 的 idempotencyKey 仍必須記錄到 ledger（否則該 Lead 結案後同一 key 重送會建出第二筆 Lead）。
  const existingOpen = await deps.leadRepo.findOpenBySessionProviderService(
    session.id,
    input.providerId,
    input.serviceType
  );
  if (existingOpen) {
    const { inserted } = await deps.leadRepo.insertIdempotencyRecord({
      sessionId: session.id,
      idempotencyKey,
      leadId: existingOpen.id,
      requestFingerprint: fingerprint,
      duplicate: true,
    });
    if (inserted) return toResult(existingOpen, true);
    // 併發競態：另一個帶同樣 key 的請求同時搶先記錄了 ledger，依它的解析結果回應。
    return resolveFromLedger(deps, session.id, idempotencyKey, fingerprint);
  }

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
  if (inserted) {
    const { inserted: ledgerInserted } = await deps.leadRepo.insertIdempotencyRecord({
      sessionId: session.id,
      idempotencyKey,
      leadId: lead.id,
      requestFingerprint: fingerprint,
      duplicate: false,
    });
    if (ledgerInserted) return toResult(lead, false);
    // 極罕見併發競態：另一個帶同樣 key 的請求剛好也在這個瞬間完成了自己的 ledger 記錄；
    // 依贏得競態的那筆記錄回應（這筆剛建立的 Lead 仍然是一筆合法但未被 key 引用的紀錄，
    // 不影響正確性，只是沒有被這次的 key 認領）。
    return resolveFromLedger(deps, session.id, idempotencyKey, fingerprint);
  }

  // 併發競態：insertLead 因唯一約束失敗，代表另一個請求剛好搶先寫入 open-duplicate；
  // 重新查詢並記錄 ledger，不把資料庫層的衝突原文往外拋（ARCHITECTURE §20.5）。
  const raceOpen = await deps.leadRepo.findOpenBySessionProviderService(session.id, input.providerId, input.serviceType);
  if (raceOpen) {
    const { inserted: ledgerInserted } = await deps.leadRepo.insertIdempotencyRecord({
      sessionId: session.id,
      idempotencyKey,
      leadId: raceOpen.id,
      requestFingerprint: fingerprint,
      duplicate: true,
    });
    if (ledgerInserted) return toResult(raceOpen, true);
    return resolveFromLedger(deps, session.id, idempotencyKey, fingerprint);
  }

  throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。");
}
