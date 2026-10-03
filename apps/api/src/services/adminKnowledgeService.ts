// TASK-B-012：Admin Knowledge Review API 業務邏輯，依 docs/API_CONTRACT.md §26.3-26.11。
// publish-preview／publish（§26.8-26.9，B-012-r3）：compute_publish_plan／admin_publish_knowledge_version
// 依 Jerry 指示 2 已補齊內容包持久化（content_packs，migration 0020），見 repo.computePublishPlan／adminPublish。
import type { AdminKnowledgeRepository } from "../repositories/types.js";
import type {
  AdminKnowledgeChangeSummary,
  AdminKnowledgeRecordSummary,
  AdminKnowledgeStatus,
  AdminPublishResult,
  AdminReviewInfo,
  AdminWithdrawResult,
  KnowledgeChangeStatus,
  KnowledgeRecordStatus,
  PublishPlan,
  RestorableVersionsResponse,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// API_CONTRACT §26.1：reason 去除前後空白後 1–500 字。
function requireReason(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new AppError("VALIDATION_ERROR", "reason 必須是去除前後空白後 1–500 字的文字。");
  }
  return trimmed;
}

function requireConfirm(value: unknown): void {
  if (value !== true) throw new AppError("VALIDATION_ERROR", "confirm 必須是 true。");
}

// MVP 只接受 NEEDS_REVIEW；省略時等同 NEEDS_REVIEW（API_CONTRACT §26.2）。
function validateStatusQuery(value: unknown): "NEEDS_REVIEW" {
  if (value === undefined || value === null || value === "") return "NEEDS_REVIEW";
  if (value !== "NEEDS_REVIEW") throw new AppError("VALIDATION_ERROR", "status 只接受 NEEDS_REVIEW。");
  return "NEEDS_REVIEW";
}

export async function getAdminKnowledgeStatus(repo: AdminKnowledgeRepository): Promise<AdminKnowledgeStatus> {
  return repo.getAdminKnowledgeStatus();
}

export async function listAdminChanges(repo: AdminKnowledgeRepository, statusQuery: unknown): Promise<AdminKnowledgeChangeSummary[]> {
  const status: KnowledgeChangeStatus = validateStatusQuery(statusQuery);
  return repo.listChanges(status);
}

export async function listAdminRecords(repo: AdminKnowledgeRepository, statusQuery: unknown): Promise<AdminKnowledgeRecordSummary[]> {
  const status: KnowledgeRecordStatus = validateStatusQuery(statusQuery);
  return repo.listRecords(status);
}

// 依 API_CONTRACT §26.6：POST /api/v1/admin/knowledge/records/{id}/decision。
export async function decideKnowledgeRecord(
  repo: AdminKnowledgeRepository,
  operatorId: string,
  recordId: unknown,
  body: unknown
): Promise<{ record: AdminKnowledgeRecordSummary; review: AdminReviewInfo }> {
  if (!isNonEmptyString(recordId)) throw new AppError("VALIDATION_ERROR", "缺少紀錄 id。");
  if (typeof body !== "object" || body === null) throw new AppError("VALIDATION_ERROR", "請求格式錯誤。");
  const input = body as Record<string, unknown>;

  if (input.decision !== "APPROVED" && input.decision !== "REJECTED") {
    throw new AppError("VALIDATION_ERROR", "decision 必須是 APPROVED 或 REJECTED。");
  }
  const reason = requireReason(input.reason);
  if (!isNonEmptyString(input.expectedContentFingerprint)) {
    throw new AppError("VALIDATION_ERROR", "缺少 expectedContentFingerprint。");
  }
  requireConfirm(input.confirm);

  const now = nowTaipeiISOString();
  const { updated, record } = await repo.decideRecord({
    recordId,
    decision: input.decision,
    reason,
    expectedContentFingerprint: input.expectedContentFingerprint,
    operatorId,
    auditId: generateId("AUDIT"),
    now,
  });

  if (!updated) {
    const existing = await repo.findRecordById(recordId);
    if (!existing) throw new AppError("NOT_FOUND", "找不到指定的紀錄。");
    if (existing.status !== "NEEDS_REVIEW") {
      throw new AppError("INVALID_STATUS_TRANSITION", "這筆紀錄已經被處理過。");
    }
    // 狀態仍是 NEEDS_REVIEW 但沒更新到：expectedContentFingerprint 跟目前實際內容不符
    // （核准當下內容已改變）。
    throw new AppError("KNOWLEDGE_STATE_CHANGED", "這筆紀錄的內容已改變，請重新讀取後再確認。");
  }

  return { record: record as AdminKnowledgeRecordSummary, review: { decision: input.decision, reason, reviewedBy: operatorId, reviewedAt: now } };
}

// 依 API_CONTRACT §26.7：POST /api/v1/admin/knowledge/changes/{id}/dismiss。
export async function dismissKnowledgeChange(
  repo: AdminKnowledgeRepository,
  operatorId: string,
  changeId: unknown,
  body: unknown
): Promise<{ change: AdminKnowledgeChangeSummary; review: AdminReviewInfo }> {
  if (!isNonEmptyString(changeId)) throw new AppError("VALIDATION_ERROR", "缺少變更 id。");
  if (typeof body !== "object" || body === null) throw new AppError("VALIDATION_ERROR", "請求格式錯誤。");
  const input = body as Record<string, unknown>;

  const reason = requireReason(input.reason);
  requireConfirm(input.confirm);

  const now = nowTaipeiISOString();
  const { updated, change } = await repo.dismissChange({ changeId, reason, operatorId, auditId: generateId("AUDIT"), now });

  if (!updated) {
    const existing = await repo.findChangeById(changeId);
    if (!existing) throw new AppError("NOT_FOUND", "找不到指定的變更。");
    throw new AppError("INVALID_STATUS_TRANSITION", "這筆變更已經被處理過。");
  }

  return { change: change as AdminKnowledgeChangeSummary, review: { decision: "DISMISSED", reason, reviewedBy: operatorId, reviewedAt: now } };
}

export async function listRestorableVersions(repo: AdminKnowledgeRepository): Promise<RestorableVersionsResponse> {
  return repo.listRestorableVersions();
}

// 依 API_CONTRACT §26.11：POST /api/v1/admin/knowledge/withdraw。
export async function withdrawKnowledgeVersion(
  repo: AdminKnowledgeRepository,
  operatorId: string,
  body: unknown
): Promise<AdminWithdrawResult> {
  if (typeof body !== "object" || body === null) throw new AppError("VALIDATION_ERROR", "請求格式錯誤。");
  const input = body as Record<string, unknown>;

  if (!isNonEmptyString(input.withdrawVersionId)) {
    throw new AppError("VALIDATION_ERROR", "缺少 withdrawVersionId。");
  }
  // republishVersionId 必須明確出現（版本 id 字串或明確的 null），省略此欄位 → VALIDATION_ERROR。
  if (!("republishVersionId" in input)) {
    throw new AppError("VALIDATION_ERROR", "缺少 republishVersionId（不恢復請明確傳 null）。");
  }
  const republishVersionId = input.republishVersionId;
  if (republishVersionId !== null && !isNonEmptyString(republishVersionId)) {
    throw new AppError("VALIDATION_ERROR", "republishVersionId 格式不合法。");
  }
  const reason = requireReason(input.reason);
  requireConfirm(input.confirm);
  if (republishVersionId === input.withdrawVersionId) {
    throw new AppError("VALIDATION_ERROR", "republishVersionId 不得等於 withdrawVersionId。");
  }

  const now = nowTaipeiISOString();
  const today = now.slice(0, 10);
  const { stateChanged, republishedVersionId } = await repo.adminWithdraw({
    withdrawVersionId: input.withdrawVersionId,
    republishVersionId: (republishVersionId as string | null) ?? null,
    reason,
    operatorId,
    auditId: generateId("AUDIT"),
    now,
    today,
  });

  if (stateChanged) {
    throw new AppError("KNOWLEDGE_STATE_CHANGED", "目前發布狀態已改變，請重新讀取後再確認。");
  }

  return {
    withdrawnVersionId: input.withdrawVersionId,
    republishedVersionId,
    withdrawnAt: now,
    withdrawnBy: operatorId,
    reason,
  };
}

// 依 API_CONTRACT §26.8：GET /api/v1/admin/knowledge/publish-preview（v0.4）。
// 不寫入任何資料，只試算；跟 publish 共用同一套 compute_publish_plan。
export async function getPublishPreview(repo: AdminKnowledgeRepository): Promise<PublishPlan> {
  return repo.computePublishPlan();
}

// 依 API_CONTRACT §26.9：POST /api/v1/admin/knowledge/publish。
export async function publishKnowledgeVersion(
  repo: AdminKnowledgeRepository,
  operatorId: string,
  body: unknown
): Promise<AdminPublishResult> {
  if (typeof body !== "object" || body === null) throw new AppError("VALIDATION_ERROR", "請求格式錯誤。");
  const input = body as Record<string, unknown>;

  if (!isNonEmptyString(input.versionId)) throw new AppError("VALIDATION_ERROR", "缺少 versionId。");
  if (!isNonEmptyString(input.previewToken)) throw new AppError("VALIDATION_ERROR", "缺少 previewToken。");
  requireConfirm(input.confirm);

  const now = nowTaipeiISOString();
  const { stateChanged, result } = await repo.adminPublish({
    versionId: input.versionId,
    previewToken: input.previewToken,
    operatorId,
    auditId: generateId("AUDIT"),
    now,
  });

  if (stateChanged) {
    throw new AppError("KNOWLEDGE_STATE_CHANGED", "發布預覽已失效，請重新讀取後再確認。");
  }

  // stateChanged=false 必定帶有 result（重算後有 blocker 的情形由 repo.adminPublish 直接拋
  // VALIDATION_ERROR，不會回到這裡），這裡的 null 只是型別上的防呆。
  if (!result) throw new AppError("INTERNAL_ERROR", "發布完成但沒有回傳結果，請稍後再試。");
  return result;
}
