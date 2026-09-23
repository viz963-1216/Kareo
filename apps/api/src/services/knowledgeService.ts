import type { KnowledgeRepository } from "../repositories/types.js";
import type { KnowledgeStatusResponse } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// KnowledgeVersion.id 格式固定為 KB-YYYY-MM-DD-NNN（依 contracts/knowledge/content-pack.schema.json
// intendedKnowledgeVersion 的 pattern），跟其他實體用 generateId() 產生的隨機 debug id 不同，
// 不能共用同一套生成邏輯。NNN 用當下秒數毫秒取 3 碼，發布操作低頻率，衝突風險極低；
// 若真的撞號，Postgres 主鍵限制會讓 publish 失敗並要求重試，不會產生錯誤資料。
export function generateKnowledgeVersionId(now = new Date()): string {
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const seq = String(taipei.getUTCMilliseconds() * 60 + taipei.getUTCSeconds()).slice(-3).padStart(3, "0");
  return `KB-${taipei.getUTCFullYear()}-${pad(taipei.getUTCMonth() + 1)}-${pad(taipei.getUTCDate())}-${seq}`;
}

// 依 docs/API_CONTRACT.md 第 13 節。無 Published 版本時回 KNOWLEDGE_UNAVAILABLE，不得假造版本號
// （承接 TASK-B-003 的 NullKnowledgeVersionResolver 佔位邏輯，這裡是真正的實作）。
export async function getKnowledgeStatus(repo: KnowledgeRepository): Promise<KnowledgeStatusResponse> {
  const status = await repo.getCurrentPublishedStatus();
  if (!status) {
    throw new AppError("KNOWLEDGE_UNAVAILABLE", "目前平台資料不足以做出可靠預估，建議聯絡 1966 或所在地長期照顧管理中心確認。");
  }
  return status;
}

export interface ApproveRecordsResult {
  approved: string[];
  notApproved: string[]; // 要求核准但目前不是 NEEDS_REVIEW（可能已核准、已拒收、不存在）
}

export async function approveRecords(repo: KnowledgeRepository, recordIds: unknown): Promise<ApproveRecordsResult> {
  if (!Array.isArray(recordIds) || recordIds.length === 0 || !recordIds.every(isNonEmptyString)) {
    throw new AppError("VALIDATION_ERROR", "recordIds 必須是非空的字串陣列。");
  }
  const approved = await repo.approveRecords(recordIds);
  const notApproved = recordIds.filter((id) => !approved.includes(id));
  return { approved, notApproved };
}

export interface PublishVersionParams {
  recordIds: unknown;
  createdBy: unknown;
  approvedBy: unknown;
  notes?: unknown;
}

// 依 contracts/knowledge/README.md §4：發布必須由授權操作者執行（受保護的內部指令，非公開 API）。
// 呼叫端（CLI）負責限制誰能執行；本函式只做欄位驗證與版本號產生。
export async function publishVersion(
  repo: KnowledgeRepository,
  params: PublishVersionParams
): Promise<{ versionId: string; publishedRecordCount: number; supersededRecordCount: number }> {
  const { recordIds, createdBy, approvedBy, notes } = params;
  if (!Array.isArray(recordIds) || recordIds.length === 0 || !recordIds.every(isNonEmptyString)) {
    throw new AppError("VALIDATION_ERROR", "recordIds 必須是非空的字串陣列。");
  }
  if (!isNonEmptyString(createdBy)) throw new AppError("VALIDATION_ERROR", "缺少 createdBy。");
  if (!isNonEmptyString(approvedBy)) throw new AppError("VALIDATION_ERROR", "缺少 approvedBy。");
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new AppError("VALIDATION_ERROR", "notes 格式不合法。");
  }

  const versionId = generateKnowledgeVersionId();
  const result = await repo.publishVersion({
    versionId,
    recordIds,
    createdBy,
    approvedBy,
    notes: (notes as string | null | undefined) ?? null,
  });
  return { versionId, ...result };
}

export interface WithdrawParams {
  reason: unknown;
  withdrawnBy: unknown;
  republishVersionId?: unknown;
}

export async function withdrawVersion(
  repo: KnowledgeRepository,
  params: WithdrawParams
): Promise<{ republishedVersionId: string | null }> {
  const { reason, withdrawnBy, republishVersionId } = params;
  if (!isNonEmptyString(reason)) throw new AppError("VALIDATION_ERROR", "缺少 reason。");
  if (!isNonEmptyString(withdrawnBy)) throw new AppError("VALIDATION_ERROR", "缺少 withdrawnBy。");
  if (republishVersionId !== undefined && republishVersionId !== null && typeof republishVersionId !== "string") {
    throw new AppError("VALIDATION_ERROR", "republishVersionId 格式不合法。");
  }

  return repo.withdrawCurrentVersion({
    reason,
    withdrawnBy,
    republishVersionId: (republishVersionId as string | null | undefined) ?? null,
  });
}
