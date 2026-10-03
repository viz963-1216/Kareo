// 測試用 Fake Repository，介面同 SupabaseAdminKnowledgeRepository，不得用於 Production。
// 讀寫共用同一份 InMemoryKnowledgeRepository 的狀態（records／versions／changes／versionRecords），
// 不另外複製一份，避免測試裡兩邊資料兜不起來。
import type { AdminKnowledgeRepository } from "./types.js";
import type { InMemoryKnowledgeRepository } from "./inMemoryKnowledgeRepository.js";
import { taipeiToday } from "../services/knowledgeService.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import type {
  AdminAuditEvent,
  AdminKnowledgeChangeSummary,
  AdminKnowledgeRecordSummary,
  AdminKnowledgeStatus,
  AdminPublishResult,
  AdminSession,
  CreatedAdminSession,
  InternalOperator,
  KnowledgeChange,
  KnowledgeRecord,
  PublishPlan,
  PublishPlanBlocker,
  RestorableVersionsResponse,
} from "../types/index.js";
import { createHash } from "node:crypto";

function toRecordSummary(r: KnowledgeRecord): AdminKnowledgeRecordSummary {
  return {
    id: r.id,
    packId: r.packId,
    recordId: r.packRecordId,
    title: r.title,
    jurisdiction: r.jurisdiction,
    category: r.category,
    sourceUrl: r.sourceUrl,
    summary: r.summary,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    contentFingerprint: r.contentFingerprint,
    status: r.status,
  };
}

function toChangeSummary(c: KnowledgeChange, sourceId: string): AdminKnowledgeChangeSummary {
  return {
    id: c.id,
    sourceId,
    detectedAt: c.detectedAt,
    previousHash: c.oldContentHash,
    currentHash: c.newContentHash,
    // 系統產生的固定說明（不是 AI 摘要——crawlerService 一律把 aiSummary 存為 null，
    // PRODUCT_SPEC §17／§43：AI 不參與政策內容判斷）；有 aiSummary 時原樣帶出。
    diffSummary: c.aiSummary ?? "偵測到內容變更，請比對 oldContent／newContent 原文確認。",
    status: c.status,
  };
}

export class InMemoryAdminKnowledgeRepository implements AdminKnowledgeRepository {
  readonly operators: InternalOperator[] = [];
  readonly adminSessions: Array<AdminSession & { tokenHash: string }> = [];
  readonly auditEvents: AdminAuditEvent[] = [];

  constructor(private readonly knowledge: InMemoryKnowledgeRepository) {}

  async findOperatorById(id: string): Promise<InternalOperator | null> {
    const found = this.operators.find((o) => o.id === id);
    return found ? { ...found } : null;
  }

  async createAdminSession(session: CreatedAdminSession & { tokenHash: string }): Promise<void> {
    const { adminToken: _adminToken, ...rest } = session;
    this.adminSessions.push({ ...rest });
  }

  async findAdminSessionByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    const found = this.adminSessions.find((s) => s.tokenHash === tokenHash);
    if (!found) return null;
    const { tokenHash: _tokenHash, ...rest } = found;
    return { ...rest };
  }

  async getAdminKnowledgeStatus(): Promise<AdminKnowledgeStatus> {
    const published = this.knowledge.versions.find((v) => v.status === "PUBLISHED") ?? null;
    const lastRun = [...this.knowledge.crawlerRuns].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0] ?? null;
    return {
      publishedVersion: published?.id ?? null,
      publishedAt: published?.publishedAt ?? null,
      lastCrawlerRun: lastRun
        ? { status: lastRun.status, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt }
        : null,
    };
  }

  async listChanges(status: string): Promise<AdminKnowledgeChangeSummary[]> {
    return this.knowledge.changes
      .filter((c) => c.status === status)
      .map((c) => toChangeSummary(c, this.knowledge.records.find((r) => r.id === c.knowledgeRecordId)?.sourceId ?? ""))
      .sort((a, b) => (a.detectedAt < b.detectedAt ? -1 : 1));
  }

  async listRecords(status: string): Promise<AdminKnowledgeRecordSummary[]> {
    return this.knowledge.records
      .filter((r) => r.status === status)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map(toRecordSummary);
  }

  async findRecordById(id: string): Promise<AdminKnowledgeRecordSummary | null> {
    const r = this.knowledge.records.find((x) => x.id === id);
    return r ? toRecordSummary(r) : null;
  }

  async findChangeById(id: string): Promise<AdminKnowledgeChangeSummary | null> {
    const c = this.knowledge.changes.find((x) => x.id === id);
    if (!c) return null;
    return toChangeSummary(c, this.knowledge.records.find((r) => r.id === c.knowledgeRecordId)?.sourceId ?? "");
  }

  async decideRecord(input: {
    recordId: string;
    decision: "APPROVED" | "REJECTED";
    reason: string;
    expectedContentFingerprint: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ updated: boolean; record: AdminKnowledgeRecordSummary | null }> {
    const r = this.knowledge.records.find(
      (x) => x.id === input.recordId && x.status === "NEEDS_REVIEW" && x.contentFingerprint === input.expectedContentFingerprint
    );
    if (!r) return { updated: false, record: null };
    r.status = input.decision;
    r.updatedAt = input.now;
    this.auditEvents.push({
      id: input.auditId,
      operatorId: input.operatorId,
      action: input.decision === "APPROVED" ? "KNOWLEDGE_RECORD_APPROVED" : "KNOWLEDGE_RECORD_REJECTED",
      targetType: "KNOWLEDGE_RECORD",
      targetId: r.id,
      reason: input.reason,
      detail: { contentFingerprint: input.expectedContentFingerprint },
      createdAt: input.now,
    });
    return { updated: true, record: toRecordSummary(r) };
  }

  async dismissChange(input: {
    changeId: string;
    reason: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ updated: boolean; change: AdminKnowledgeChangeSummary | null }> {
    const c = this.knowledge.changes.find((x) => x.id === input.changeId && x.status === "NEEDS_REVIEW");
    if (!c) return { updated: false, change: null };
    c.status = "DISMISSED";
    c.reviewedAt = input.now;
    c.reviewedBy = input.operatorId;
    this.auditEvents.push({
      id: input.auditId,
      operatorId: input.operatorId,
      action: "KNOWLEDGE_CHANGE_DISMISSED",
      targetType: "KNOWLEDGE_CHANGE",
      targetId: c.id,
      reason: input.reason,
      detail: null,
      createdAt: input.now,
    });
    const sourceId = this.knowledge.records.find((r) => r.id === c.knowledgeRecordId)?.sourceId ?? "";
    return { updated: true, change: toChangeSummary(c, sourceId) };
  }

  async listRestorableVersions(): Promise<RestorableVersionsResponse> {
    const current = this.knowledge.versions.find((v) => v.status === "PUBLISHED") ?? null;
    const currentVersion = current
      ? {
          versionId: current.id,
          publishedAt: current.publishedAt as string,
          recordCount: this.knowledge.versionRecords.get(current.id)?.size ?? 0,
        }
      : null;

    const today = taipeiToday();
    const versions = this.knowledge.versions
      .filter((v) => v.status === "ARCHIVED" && v.id !== current?.id && v.withdrawnAt === null)
      .filter((v) => (this.knowledge.versionRecords.get(v.id)?.size ?? 0) >= 1)
      .filter((v) => {
        const memberIds = this.knowledge.versionRecords.get(v.id) ?? new Set<string>();
        return ![...memberIds].some((id) => {
          const r = this.knowledge.records.find((x) => x.id === id);
          return r?.effectiveTo !== null && r?.effectiveTo !== undefined && r.effectiveTo < today;
        });
      })
      .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1))
      .map((v) => ({
        versionId: v.id,
        publishedAt: v.publishedAt as string,
        approvedBy: v.approvedBy,
        notes: v.notes,
        recordCount: this.knowledge.versionRecords.get(v.id)?.size ?? 0,
      }));

    return { currentVersion, versions };
  }

  async adminWithdraw(input: {
    withdrawVersionId: string;
    republishVersionId: string | null;
    reason: string;
    operatorId: string;
    auditId: string;
    now: string;
    today: string;
  }): Promise<{ stateChanged: boolean; republishedVersionId: string | null }> {
    const current = this.knowledge.versions.find((v) => v.status === "PUBLISHED") ?? null;
    if (!current || current.id !== input.withdrawVersionId) {
      return { stateChanged: true, republishedVersionId: null };
    }

    if (input.republishVersionId !== null) {
      if (input.republishVersionId === input.withdrawVersionId) return { stateChanged: true, republishedVersionId: null };
      const target = this.knowledge.versions.find((v) => v.id === input.republishVersionId);
      if (!target || target.status !== "ARCHIVED" || target.withdrawnAt !== null) {
        return { stateChanged: true, republishedVersionId: null };
      }
      const memberIds = this.knowledge.versionRecords.get(target.id) ?? new Set<string>();
      if (memberIds.size === 0) return { stateChanged: true, republishedVersionId: null };
      const hasExpired = [...memberIds].some((id) => {
        const r = this.knowledge.records.find((x) => x.id === id);
        return r?.effectiveTo !== null && r?.effectiveTo !== undefined && r.effectiveTo < input.today;
      });
      if (hasExpired) return { stateChanged: true, republishedVersionId: null };
    }

    const result = await this.knowledge.withdrawCurrentVersion({
      reason: input.reason,
      withdrawnBy: input.operatorId,
      republishVersionId: input.republishVersionId,
    });

    this.auditEvents.push({
      id: input.auditId,
      operatorId: input.operatorId,
      action: "KNOWLEDGE_VERSION_WITHDRAWN",
      targetType: "KNOWLEDGE_VERSION",
      targetId: input.withdrawVersionId,
      reason: input.reason,
      detail: { republishVersionId: input.republishVersionId },
      createdAt: input.now,
    });

    return { stateChanged: false, republishedVersionId: result.republishedVersionId };
  }

  // 跟 migration 0020 compute_publish_plan 同一套邏輯的 JS 版本（InMemory 測試用）：
  // 候選紀錄＝status APPROVED 且所屬內容包在 content_packs 中 status APPROVED。
  private computePlan(): PublishPlan {
    const today = taipeiToday();
    const current = this.knowledge.versions.find((v) => v.status === "PUBLISHED") ?? null;
    const blockers: PublishPlanBlocker[] = [];

    const approved = this.knowledge.records.filter((r) => r.status === "APPROVED");
    const packApproved = (packId: string) => this.knowledge.contentPacks.find((p) => p.id === packId)?.status === "APPROVED";
    const packBlocked = approved.filter((r) => !packApproved(r.packId));

    const emptyPlan = (blockers: PublishPlanBlocker[]): PublishPlan => ({
      canPublish: false,
      targetVersionId: null,
      currentVersionId: current?.id ?? null,
      publishDate: today,
      publishedRecordCount: 0,
      carriedForwardCount: 0,
      totalRecordCount: 0,
      supersededRecordCount: 0,
      excludedRecordCount: 0,
      newRecords: [],
      blockers,
      previewToken: null,
      generatedAt: nowTaipeiISOString(),
    });

    if (approved.length === 0) {
      return emptyPlan([{ code: "NO_APPROVED_RECORDS", message: "目前沒有任何已核准的紀錄。" }]);
    }
    if (packBlocked.length > 0) {
      return emptyPlan([{ code: "PACK_NOT_APPROVED", message: "內容包資料尚未登錄。" }]);
    }

    const candidates = approved.filter((r) => packApproved(r.packId));
    const targetVersions = [...new Set(candidates.map((r) => this.knowledge.contentPacks.find((p) => p.id === r.packId)!.intendedKnowledgeVersion))];
    const KB_PATTERN = /^KB-\d{4}-\d{2}-\d{2}-\d{3}$/;
    const firstTargetVersion = targetVersions[0];
    if (targetVersions.length === 0 || firstTargetVersion === null || !KB_PATTERN.test(firstTargetVersion)) {
      return emptyPlan([{ code: "TARGET_VERSION_INVALID", message: "內容包缺少或格式不合法的 intendedKnowledgeVersion。" }]);
    }
    if (targetVersions.length > 1) {
      return emptyPlan([{ code: "TARGET_VERSION_CONFLICT", message: "候選紀錄所屬內容包的 intendedKnowledgeVersion 不只一個。" }]);
    }
    const targetVersionId = firstTargetVersion;

    const newRecords = candidates.filter((r) => r.effectiveTo === null || r.effectiveTo >= today);
    const excluded = candidates.filter((r) => r.effectiveTo !== null && r.effectiveTo < today);

    if (newRecords.length === 0) {
      return emptyPlan([{ code: "ALL_CANDIDATES_EXPIRED", message: "候選紀錄的 effectiveTo 全部早於發布日。" }]);
    }
    if (this.knowledge.versions.some((v) => v.id === targetVersionId)) {
      return emptyPlan([{ code: "VERSION_ALREADY_EXISTS", message: `版本 ${targetVersionId} 已存在，不得覆寫或改用其他號碼。` }]);
    }

    const isReplacedOrExpired = (old: KnowledgeRecord) =>
      (old.effectiveTo !== null && old.effectiveTo < today) ||
      newRecords.some(
        (nr) => nr.jurisdiction === old.jurisdiction && (nr.ruleData as Record<string, unknown>)?.type === (old.ruleData as Record<string, unknown>)?.type && nr.title === old.title
      );
    const currentPublished = this.knowledge.records.filter((r) => r.status === "PUBLISHED");
    const superseded = currentPublished.filter(isReplacedOrExpired);
    const carried = currentPublished.filter((r) => !isReplacedOrExpired(r));

    const packSummaries = [...new Set(newRecords.map((r) => r.packId))]
      .map((id) => this.knowledge.contentPacks.find((p) => p.id === id)!)
      .sort((a, b) => a.id.localeCompare(b.id));

    const tokenInput = [
      targetVersionId,
      current?.id ?? "",
      today,
      newRecords.map((r) => `${r.id}:${r.contentFingerprint}`).sort().join(","),
      carried.map((r) => `${r.id}:${r.contentFingerprint}`).sort().join(","),
      excluded.map((r) => r.id).sort().join(","),
      packSummaries.map((p) => `${p.id}:${p.status}:${p.packFingerprint}`).join(","),
    ].join("|");
    const token = `PPV-sha256:${createHash("sha256").update(tokenInput).digest("hex")}`;

    return {
      canPublish: true,
      targetVersionId,
      currentVersionId: current?.id ?? null,
      publishDate: today,
      publishedRecordCount: newRecords.length,
      carriedForwardCount: carried.length,
      totalRecordCount: newRecords.length + carried.length,
      supersededRecordCount: superseded.length,
      excludedRecordCount: excluded.length,
      newRecords: newRecords.map((r) => ({
        id: r.id,
        packId: r.packId,
        recordId: r.packRecordId,
        title: r.title,
        jurisdiction: r.jurisdiction,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
      })),
      blockers: [],
      previewToken: token,
      generatedAt: nowTaipeiISOString(),
    };
  }

  async computePublishPlan(): Promise<PublishPlan> {
    return this.computePlan();
  }

  async adminPublish(input: {
    versionId: string;
    previewToken: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ stateChanged: boolean; result: AdminPublishResult | null }> {
    const plan = this.computePlan();
    // 跟 SQL 版 admin_publish_knowledge_version（migration 0020）完全相同的順序：先看重算後
    // 有沒有 blocker（VALIDATION_ERROR，不算「狀態改變」，操作者沒有機會重新確認過期的預覽），
    // 再比對 versionId／previewToken 是否還跟操作者確認當下一致（不一致才是 KNOWLEDGE_STATE_CHANGED）。
    if (!plan.canPublish) {
      throw new AppError("VALIDATION_ERROR", plan.blockers[0]?.message ?? "目前無法發布。");
    }
    if (plan.targetVersionId !== input.versionId || plan.previewToken !== input.previewToken) {
      return { stateChanged: true, result: null };
    }

    const recordIds = plan.newRecords.map((r) => r.id);
    const result = await this.knowledge.publishVersion({
      versionId: input.versionId,
      recordIds,
      createdBy: input.operatorId,
      approvedBy: input.operatorId,
      notes: null,
    });

    this.auditEvents.push({
      id: input.auditId,
      operatorId: input.operatorId,
      action: "KNOWLEDGE_VERSION_PUBLISHED",
      targetType: "KNOWLEDGE_VERSION",
      targetId: input.versionId,
      reason: null,
      detail: result,
      createdAt: input.now,
    });

    return {
      stateChanged: false,
      result: {
        versionId: input.versionId,
        publishedAt: input.now,
        publishedRecordCount: result.publishedRecordCount,
        carriedForwardCount: result.carriedForwardCount,
        totalRecordCount: result.publishedRecordCount + result.carriedForwardCount,
        supersededRecordCount: result.supersededRecordCount,
        excludedRecordCount: plan.excludedRecordCount,
      },
    };
  }
}
