// 測試用 Fake Repository：模擬 Supabase Postgres function 的原子行為（在記憶體中的副本上操作，
// 全部成功才寫回正式資料，任一步失敗則完全不變），不得用於 Production。
import type { KnowledgeRepository, PublishVersionInput } from "./types.js";
import type { KnowledgeCategory, KnowledgeRecord, KnowledgeStatusResponse, KnowledgeVersion, Jurisdiction } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

const NOTICE = "長照制度及補助可能隨時調整，實際資格仍請洽 1966 或所在地長期照顧管理中心。";

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  readonly records: KnowledgeRecord[] = [];
  readonly versions: KnowledgeVersion[] = [];

  // 測試用：讓 publish / withdraw 模擬寫入失敗（驗證失敗時不留半套資料）。
  failNextPublish = false;
  failNextWithdraw = false;

  async findByPackRecordIds(packId: string, packRecordIds: string[]): Promise<Set<string>> {
    return new Set(
      this.records.filter((r) => r.packId === packId && packRecordIds.includes(r.packRecordId)).map((r) => r.packRecordId)
    );
  }

  async findRecordsByPackId(packId: string): Promise<KnowledgeRecord[]> {
    return this.records.filter((r) => r.packId === packId).map((r) => ({ ...r }));
  }

  async findPublishedByKey(
    jurisdiction: Jurisdiction,
    category: KnowledgeCategory,
    title: string
  ): Promise<KnowledgeRecord | null> {
    return (
      this.records.find(
        (r) => r.jurisdiction === jurisdiction && r.category === category && r.title === title && r.status === "PUBLISHED"
      ) ?? null
    );
  }

  async insertRecords(records: KnowledgeRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async approveRecords(recordIds: string[]): Promise<string[]> {
    const updated: string[] = [];
    for (const r of this.records) {
      if (recordIds.includes(r.id) && r.status === "NEEDS_REVIEW") {
        r.status = "APPROVED";
        updated.push(r.id);
      }
    }
    return updated;
  }

  async versionExists(versionId: string): Promise<boolean> {
    return this.versions.some((v) => v.id === versionId);
  }

  // 模擬 migration 0011 的 publish_knowledge_version：取代／失效的舊 PUBLISHED 紀錄 → SUPERSEDED；
  // 其餘未被取代且未失效的舊 PUBLISHED 紀錄帶入新版本（D-03-v2）。
  async publishVersion(
    input: PublishVersionInput
  ): Promise<{ publishedRecordCount: number; supersededRecordCount: number; carriedForwardCount: number }> {
    if (this.failNextPublish) {
      this.failNextPublish = false;
      throw new AppError("INTERNAL_ERROR", "模擬發布失敗");
    }
    if (this.versions.some((v) => v.id === input.versionId)) {
      throw new AppError("INTERNAL_ERROR", `publish_knowledge_version: version ${input.versionId} already exists`);
    }

    const missing = input.recordIds.filter(
      (id) => !this.records.some((r) => r.id === id && r.status === "APPROVED")
    );
    if (missing.length > 0) {
      throw new AppError("INTERNAL_ERROR", `publish_knowledge_version: recordIds not APPROVED: ${missing.join(",")}`);
    }

    const today = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const newRecords = this.records.filter((r) => input.recordIds.includes(r.id));

    let supersededRecordCount = 0;
    for (const old of this.records) {
      if (old.status !== "PUBLISHED") continue;
      const replaced = newRecords.some(
        (n) => n.jurisdiction === old.jurisdiction && (n.ruleData as Record<string, unknown>)?.type === (old.ruleData as Record<string, unknown>)?.type && n.title === old.title
      );
      const expired = old.effectiveTo !== null && old.effectiveTo < today;
      if (replaced || expired) {
        old.status = "SUPERSEDED";
        supersededRecordCount++;
      }
    }

    for (const v of this.versions) {
      if (v.status === "PUBLISHED") v.status = "ARCHIVED";
    }

    this.versions.push({
      id: input.versionId,
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
      createdBy: input.createdBy,
      approvedBy: input.approvedBy,
      notes: input.notes,
    });

    let carriedForwardCount = 0;
    for (const r of this.records) {
      if (r.status === "PUBLISHED" && r.version !== input.versionId) {
        r.version = input.versionId;
        carriedForwardCount++;
      }
    }

    let publishedRecordCount = 0;
    for (const r of this.records) {
      if (input.recordIds.includes(r.id) && r.status === "APPROVED") {
        r.status = "PUBLISHED";
        r.version = input.versionId;
        publishedRecordCount++;
      }
    }

    return { publishedRecordCount, supersededRecordCount, carriedForwardCount };
  }

  async withdrawCurrentVersion(input: {
    reason: string;
    withdrawnBy: string;
    republishVersionId?: string | null;
  }): Promise<{ republishedVersionId: string | null }> {
    if (this.failNextWithdraw) {
      this.failNextWithdraw = false;
      throw new AppError("INTERNAL_ERROR", "模擬撤回失敗");
    }

    const current = this.versions.find((v) => v.status === "PUBLISHED");
    if (!current) {
      throw new AppError("INTERNAL_ERROR", "withdraw_knowledge_version: no PUBLISHED version to withdraw");
    }

    current.status = "ARCHIVED";
    for (const r of this.records) {
      if (r.version === current.id && r.status === "PUBLISHED") r.status = "SUPERSEDED";
    }

    const republishVersionId = input.republishVersionId ?? null;
    if (republishVersionId) {
      const target = this.versions.find((v) => v.id === republishVersionId && v.status === "ARCHIVED");
      if (!target) {
        throw new AppError(
          "INTERNAL_ERROR",
          `withdraw_knowledge_version: republishVersionId ${republishVersionId} is not an ARCHIVED version`
        );
      }
      target.status = "PUBLISHED";
      for (const r of this.records) {
        if (r.version === republishVersionId && r.status === "SUPERSEDED") r.status = "PUBLISHED";
      }
    }

    return { republishedVersionId: republishVersionId };
  }

  async getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null> {
    const version = this.versions.find((v) => v.status === "PUBLISHED");
    if (!version) return null;

    const verified = this.records
      .filter((r) => r.version === version.id)
      .map((r) => r.lastVerifiedAt)
      .sort()
      .reverse()[0];

    return {
      version: version.id,
      publishedAt: version.publishedAt as string,
      lastVerifiedAt: verified ?? (version.publishedAt as string),
      notice: NOTICE,
    };
  }
}
