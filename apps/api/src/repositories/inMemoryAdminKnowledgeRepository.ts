// 測試用 Fake Repository，介面同 SupabaseAdminKnowledgeRepository，不得用於 Production。
// 讀寫共用同一份 InMemoryKnowledgeRepository 的狀態（records／versions／changes／versionRecords），
// 不另外複製一份，避免測試裡兩邊資料兜不起來。
import type { AdminKnowledgeRepository } from "./types.js";
import type { InMemoryKnowledgeRepository } from "./inMemoryKnowledgeRepository.js";
import { taipeiToday } from "../services/knowledgeService.js";
import type {
  AdminAuditEvent,
  AdminKnowledgeChangeSummary,
  AdminKnowledgeRecordSummary,
  AdminKnowledgeStatus,
  AdminSession,
  CreatedAdminSession,
  InternalOperator,
  KnowledgeChange,
  KnowledgeRecord,
  RestorableVersionsResponse,
} from "../types/index.js";

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
}
