// 測試用 Fake Repository：模擬 Supabase Postgres function 的原子行為（在記憶體中的副本上操作，
// 全部成功才寫回正式資料，任一步失敗則完全不變），不得用於 Production。
import type { KnowledgeRepository, PublishVersionInput } from "./types.js";
import type { KnowledgeCategory, KnowledgeRecord, KnowledgeStatusResponse, KnowledgeVersion, Jurisdiction } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

const NOTICE = "長照制度及補助可能隨時調整，實際資格仍請洽 1966 或所在地長期照顧管理中心。";

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  readonly records: KnowledgeRecord[] = [];
  readonly versions: KnowledgeVersion[] = [];
  // migration 0013 knowledge_version_records 的記憶體版本：每個版本「當時」實際包含的完整紀錄集合
  // （新發布 + carry-forward），不可變、不覆寫——追溯與回復都依這份資料，不依賴 knowledge_records.version
  // （該欄位現在是「第一次發布時的版本」，不可變，對被 carry-forward 超過一次的紀錄無法正確反映
  // 「目前這個版本包含哪些紀錄」）。
  readonly versionRecords = new Map<string, Set<string>>();

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

  async updateRecordContent(
    id: string,
    content: Omit<KnowledgeRecord, "id" | "createdAt" | "updatedAt" | "packId" | "packRecordId" | "status" | "version">
  ): Promise<void> {
    const record = this.records.find((r) => r.id === id);
    if (!record) throw new AppError("INTERNAL_ERROR", `updateRecordContent: record ${id} not found`);
    if (record.status === "PUBLISHED") {
      throw new AppError("INTERNAL_ERROR", `無法更新紀錄 ${id}：目前狀態為 PUBLISHED，不可用匯入覆寫已發布的歷史內容。`);
    }
    Object.assign(record, content, { status: "NEEDS_REVIEW" as const, version: null, updatedAt: new Date().toISOString() });
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

    // 未被取代、未失效的舊 PUBLISHED 紀錄：帶入新版本，但 version 欄位不變（不可變，第一次發布時的版本）。
    const carriedForwardCount = this.records.filter((r) => r.status === "PUBLISHED").length;

    let publishedRecordCount = 0;
    for (const r of this.records) {
      if (input.recordIds.includes(r.id) && r.status === "APPROVED") {
        r.status = "PUBLISHED";
        r.version = input.versionId;
        publishedRecordCount++;
      }
    }

    // 這個版本的完整內容快照（新發布 + carry-forward）：兩者聯集，寫入不可變關聯表。
    const snapshot = new Set(this.records.filter((r) => r.status === "PUBLISHED").map((r) => r.id));
    this.versionRecords.set(input.versionId, snapshot);

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

    const republishVersionId = input.republishVersionId ?? null;
    // J-003 H-4：不得把剛撤回的版本原地當成回復目標。
    if (republishVersionId !== null && republishVersionId === current.id) {
      throw new AppError(
        "INTERNAL_ERROR",
        "withdraw_knowledge_version: republishVersionId cannot equal the version being withdrawn"
      );
    }

    // 先驗證回復目標存在且為 ARCHIVED，驗證失敗完全不動任何資料——模擬 SQL function 在同一個
    // transaction 內 raise exception 會整個回滾的行為（這裡是 in-memory mock，JS 物件的變動不會
    // 自動回滾，所以必須在真正修改任何狀態「之前」就把所有可能失敗的檢查做完，而不是先改了一半
    // 才發現失敗——這正是本檔最上方的類別註解要求的「全部成功才寫回，任一步失敗則完全不變」）。
    const target = republishVersionId
      ? this.versions.find((v) => v.id === republishVersionId && v.status === "ARCHIVED")
      : null;
    if (republishVersionId && !target) {
      throw new AppError(
        "INTERNAL_ERROR",
        `withdraw_knowledge_version: republishVersionId ${republishVersionId} is not an ARCHIVED version`
      );
    }

    current.status = "ARCHIVED";
    // 目前版本實際包含的紀錄（含 carry-forward 進來的），依 versionRecords 快照判斷，全部 SUPERSEDED。
    const currentSet = this.versionRecords.get(current.id) ?? new Set<string>();
    for (const r of this.records) {
      if (currentSet.has(r.id) && r.status === "PUBLISHED") r.status = "SUPERSEDED";
    }

    if (target) {
      target.status = "PUBLISHED";
      // 回復目標版本「當時」的完整內容（依 versionRecords 快照），不管這些紀錄目前個別狀態為何。
      const restoreSet = this.versionRecords.get(target.id) ?? new Set<string>();
      for (const r of this.records) {
        if (restoreSet.has(r.id)) r.status = "PUBLISHED";
      }
    }

    return { republishedVersionId: republishVersionId };
  }

  async getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null> {
    const version = this.versions.find((v) => v.status === "PUBLISHED");
    if (!version) return null;

    const currentSet = this.versionRecords.get(version.id) ?? new Set<string>();
    const verified = this.records
      .filter((r) => currentSet.has(r.id))
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
