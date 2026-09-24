import type { KnowledgeRepository } from "../repositories/types.js";
import type { KnowledgeStatusResponse } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// B-008-r2（D-03）：版號不再由本檔生成，一律採用內容包核准時 Jerry 確認的 intendedKnowledgeVersion，
// 讓正式發布出來的版號跟核准紀錄可以對得上。格式仍是 contracts/knowledge/content-pack.schema.json
// 定義的 KB-YYYY-MM-DD-NNN。
export const KNOWLEDGE_VERSION_ID = /^KB-\d{4}-\d{2}-\d{2}-\d{3}$/;

export function taipeiToday(now = new Date()): string {
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${taipei.getUTCFullYear()}-${pad(taipei.getUTCMonth() + 1)}-${pad(taipei.getUTCDate())}`;
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

// 發布指令可一次接受多個內容包（D-03-v2）：全部必須是 APPROVED 狀態、intendedKnowledgeVersion 相同。
// 本函式只看 shell 層的 status／intendedKnowledgeVersion；每個內容包實際核准了哪些紀錄由 CLI 用
// repo.findRecordsByPackId() 查詢後篩出 APPROVED 的紀錄，傳進 candidateRecords。
export interface PublishPackShell {
  status: unknown;
  intendedKnowledgeVersion: unknown;
}

export interface PublishCandidateRecord {
  id: string;
  effectiveTo: string | null; // YYYY-MM-DD 或 null
}

export interface PublishVersionParams {
  packs: unknown; // PublishPackShell[]
  candidateRecords: unknown; // PublishCandidateRecord[]
  createdBy: unknown;
  approvedBy: unknown;
  notes?: unknown;
  today?: string; // 注入用（測試），預設今天（Asia/Taipei）
}

function isNonEmptyStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);
}

// 依 contracts/knowledge/README.md §4／D-03／D-03-v2：發布必須由授權操作者執行（受保護的內部指令，
// 非公開 API）。呼叫端（CLI）負責限制誰能執行；本函式做欄位驗證、版號一致性檢查與失效紀錄排除，
// 業務層的「取代／帶入前版」邏輯在 SQL function 內完成（需要當下資料庫狀態，見 migration 0011）。
export async function publishVersion(
  repo: KnowledgeRepository,
  params: PublishVersionParams
): Promise<{
  versionId: string;
  publishedRecordCount: number;
  supersededRecordCount: number;
  carriedForwardCount: number;
  excludedRecordIds: string[];
}> {
  const { packs, candidateRecords, createdBy, approvedBy, notes, today } = params;

  if (!Array.isArray(packs) || packs.length === 0) {
    throw new AppError("VALIDATION_ERROR", "缺少內容包。");
  }
  const versions = new Set<string>();
  for (const raw of packs) {
    const p = raw as Partial<PublishPackShell> | null;
    if (typeof p !== "object" || p === null) throw new AppError("VALIDATION_ERROR", "內容包格式不合法。");
    if (p.status !== "APPROVED") {
      throw new AppError("VALIDATION_ERROR", "所有內容包必須是 APPROVED 狀態才能發布。");
    }
    if (!isNonEmptyString(p.intendedKnowledgeVersion) || !KNOWLEDGE_VERSION_ID.test(p.intendedKnowledgeVersion)) {
      throw new AppError("VALIDATION_ERROR", "intendedKnowledgeVersion 缺漏或格式不合法（需為 KB-YYYY-MM-DD-NNN）。");
    }
    versions.add(p.intendedKnowledgeVersion);
  }
  if (versions.size > 1) {
    throw new AppError("VALIDATION_ERROR", "多個內容包的 intendedKnowledgeVersion 不一致，拒絕發布。");
  }
  const versionId = [...versions][0];

  if (await repo.versionExists(versionId)) {
    throw new AppError("VALIDATION_ERROR", `版本 ${versionId} 已存在，不得覆寫或改用其他號碼。`);
  }

  if (!Array.isArray(candidateRecords) || candidateRecords.length === 0) {
    throw new AppError("VALIDATION_ERROR", "沒有已核准可發布的紀錄。");
  }
  if (!isNonEmptyString(createdBy)) throw new AppError("VALIDATION_ERROR", "缺少 createdBy。");
  if (!isNonEmptyString(approvedBy)) throw new AppError("VALIDATION_ERROR", "缺少 approvedBy。");
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new AppError("VALIDATION_ERROR", "notes 格式不合法。");
  }

  const publishDate = today ?? taipeiToday();
  const excludedRecordIds: string[] = [];
  const includedRecordIds: string[] = [];
  for (const r of candidateRecords as PublishCandidateRecord[]) {
    if (r.effectiveTo !== null && r.effectiveTo < publishDate) excludedRecordIds.push(r.id);
    else includedRecordIds.push(r.id);
  }
  if (!isNonEmptyStringArray(includedRecordIds)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `全部 ${excludedRecordIds.length} 筆候選紀錄的 effectiveTo 皆早於發布日（${publishDate}），沒有東西可以發布。`
    );
  }

  const result = await repo.publishVersion({
    versionId,
    recordIds: includedRecordIds,
    createdBy,
    approvedBy,
    notes: (notes as string | null | undefined) ?? null,
  });
  return { versionId, excludedRecordIds, ...result };
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
