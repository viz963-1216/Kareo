import { getSupabaseClient } from "./supabaseClient.js";
import type { KnowledgeRepository, PublishVersionInput } from "./types.js";
import type {
  CrawlerRun,
  KnowledgeCategory,
  KnowledgeChange,
  KnowledgeRecord,
  KnowledgeStatusResponse,
  Jurisdiction,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";

const NOTICE = "長照制度及補助可能隨時調整，實際資格仍請洽 1966 或所在地長期照顧管理中心。";

function toDbRecord(r: KnowledgeRecord) {
  return {
    id: r.id,
    source_id: r.sourceId,
    title: r.title,
    category: r.category,
    jurisdiction: r.jurisdiction,
    source_url: r.sourceUrl,
    published_at: r.publishedAt,
    effective_from: r.effectiveFrom,
    effective_to: r.effectiveTo,
    fetched_at: r.fetchedAt,
    last_verified_at: r.lastVerifiedAt,
    content_hash: r.contentHash,
    status: r.status,
    version: r.version,
    raw_text: r.rawText,
    summary: r.summary,
    rule_data: r.ruleData,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    pack_id: r.packId,
    pack_record_id: r.packRecordId,
  };
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  async findByPackRecordIds(packId: string, packRecordIds: string[]): Promise<Set<string>> {
    if (packRecordIds.length === 0) return new Set();
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .select("pack_record_id")
      .eq("pack_id", packId)
      .in("pack_record_id", packRecordIds);
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢既有 Knowledge 紀錄，請稍後再試。");
    return new Set((data ?? []).map((r) => r.pack_record_id as string));
  }

  async findRecordsByPackId(packId: string): Promise<KnowledgeRecord[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .select(
        "id, source_id, title, category, jurisdiction, source_url, published_at, effective_from, effective_to, fetched_at, last_verified_at, content_hash, status, version, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id"
      )
      .eq("pack_id", packId);
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 紀錄，請稍後再試。");
    return (data ?? []).map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      category: row.category,
      jurisdiction: row.jurisdiction,
      sourceUrl: row.source_url,
      publishedAt: row.published_at,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      fetchedAt: row.fetched_at,
      lastVerifiedAt: row.last_verified_at,
      contentHash: row.content_hash,
      status: row.status,
      version: row.version,
      rawText: row.raw_text,
      summary: row.summary,
      ruleData: row.rule_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      packId: row.pack_id,
      packRecordId: row.pack_record_id,
    }));
  }

  async findPublishedByKey(
    jurisdiction: Jurisdiction,
    category: KnowledgeCategory,
    title: string
  ): Promise<KnowledgeRecord | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .select(
        "id, source_id, title, category, jurisdiction, source_url, published_at, effective_from, effective_to, fetched_at, last_verified_at, content_hash, status, version, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id"
      )
      .eq("jurisdiction", jurisdiction)
      .eq("category", category)
      .eq("title", title)
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 紀錄，請稍後再試。");
    if (!data) return null;
    return {
      id: data.id,
      sourceId: data.source_id,
      title: data.title,
      category: data.category,
      jurisdiction: data.jurisdiction,
      sourceUrl: data.source_url,
      publishedAt: data.published_at,
      effectiveFrom: data.effective_from,
      effectiveTo: data.effective_to,
      fetchedAt: data.fetched_at,
      lastVerifiedAt: data.last_verified_at,
      contentHash: data.content_hash,
      status: data.status,
      version: data.version,
      rawText: data.raw_text,
      summary: data.summary,
      ruleData: data.rule_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      packId: data.pack_id,
      packRecordId: data.pack_record_id,
    };
  }

  // 單一資料表的單一 insert 呼叫本身就是一個交易（不像 Provider 三表，這裡不需要另外包 rpc）。
  async insertRecords(records: KnowledgeRecord[]): Promise<void> {
    if (records.length === 0) return;
    const client = getSupabaseClient();
    const { error } = await client.from("knowledge_records").insert(records.map(toDbRecord));
    if (error) throw new AppError("INTERNAL_ERROR", "無法匯入 Knowledge 紀錄，請稍後再試。", { cause: error });
  }

  async approveRecords(recordIds: string[]): Promise<string[]> {
    if (recordIds.length === 0) return [];
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .update({ status: "APPROVED" })
      .in("id", recordIds)
      .eq("status", "NEEDS_REVIEW")
      .select("id");
    if (error) throw new AppError("INTERNAL_ERROR", "無法核准 Knowledge 紀錄，請稍後再試。", { cause: error });
    return (data ?? []).map((r) => r.id as string);
  }

  async publishVersion(
    input: PublishVersionInput
  ): Promise<{ publishedRecordCount: number; supersededRecordCount: number }> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("publish_knowledge_version", {
      payload: {
        versionId: input.versionId,
        recordIds: input.recordIds,
        createdBy: input.createdBy,
        approvedBy: input.approvedBy,
        notes: input.notes,
      },
    });
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法發布 Knowledge 版本，交易已回滾，沒有寫入任何資料。", {
        cause: error,
      });
    }
    const result = data as { publishedRecordCount: number; supersededRecordCount: number };
    return result;
  }

  async withdrawCurrentVersion(input: {
    reason: string;
    withdrawnBy: string;
    republishVersionId?: string | null;
  }): Promise<{ republishedVersionId: string | null }> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("withdraw_knowledge_version", {
      payload: {
        reason: input.reason,
        withdrawnBy: input.withdrawnBy,
        republishVersionId: input.republishVersionId ?? null,
      },
    });
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法撤回 Knowledge 版本，交易已回滾。", { cause: error });
    }
    return data as { republishedVersionId: string | null };
  }

  async findLatestRecordBySourceId(sourceId: string): Promise<KnowledgeRecord | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .select(
        "id, source_id, title, category, jurisdiction, source_url, published_at, effective_from, effective_to, fetched_at, last_verified_at, content_hash, status, version, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id"
      )
      .eq("source_id", sourceId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 紀錄，請稍後再試。");
    if (!data) return null;
    return {
      id: data.id,
      sourceId: data.source_id,
      title: data.title,
      category: data.category,
      jurisdiction: data.jurisdiction,
      sourceUrl: data.source_url,
      publishedAt: data.published_at,
      effectiveFrom: data.effective_from,
      effectiveTo: data.effective_to,
      fetchedAt: data.fetched_at,
      lastVerifiedAt: data.last_verified_at,
      contentHash: data.content_hash,
      status: data.status,
      version: data.version,
      rawText: data.raw_text,
      summary: data.summary,
      ruleData: data.rule_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      packId: data.pack_id,
      packRecordId: data.pack_record_id,
    };
  }

  async insertKnowledgeChange(change: KnowledgeChange): Promise<{ inserted: boolean }> {
    const client = getSupabaseClient();
    const { error } = await client.from("knowledge_changes").insert({
      id: change.id,
      knowledge_record_id: change.knowledgeRecordId,
      old_content_hash: change.oldContentHash,
      new_content_hash: change.newContentHash,
      old_content: change.oldContent,
      new_content: change.newContent,
      ai_summary: change.aiSummary,
      status: change.status,
      detected_at: change.detectedAt,
      reviewed_at: change.reviewedAt,
      reviewed_by: change.reviewedBy,
    });
    if (error) {
      // 23505 = unique_violation：migration 0013 的 partial unique index
      // (knowledge_record_id, new_content_hash) where status='NEEDS_REVIEW' 擋下了重複寫入——
      // 代表同一筆尚未審核的變更已存在（重跑／重試／併發皆可能觸發），是預期內、安全的情況，
      // 不是真正的錯誤（B-009-r2，Jerry PR #37 第 3 項：資料庫層冪等／唯一性保障）。
      if (error.code === "23505") return { inserted: false };
      throw new AppError("INTERNAL_ERROR", "無法寫入 KnowledgeChange，請稍後再試。", { cause: error });
    }
    return { inserted: true };
  }

  async insertCrawlerRun(run: CrawlerRun): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from("crawler_runs").insert({
      id: run.id,
      source_id: run.sourceId,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      status: run.status,
      items_checked: run.itemsChecked,
      changes_detected: run.changesDetected,
      content_hash: run.contentHash,
      error_message: run.errorMessage,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法寫入 CrawlerRun，請稍後再試。", { cause: error });
  }

  async getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null> {
    const client = getSupabaseClient();
    const { data: version, error: versionError } = await client
      .from("knowledge_versions")
      .select("id, published_at")
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (versionError) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 版本，請稍後再試。");
    if (!version) return null;

    const { data: verifiedRows, error: verifiedError } = await client
      .from("knowledge_records")
      .select("last_verified_at")
      .eq("version", version.id)
      .order("last_verified_at", { ascending: false })
      .limit(1);
    if (verifiedError) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 紀錄，請稍後再試。");

    return {
      version: version.id,
      publishedAt: version.published_at,
      lastVerifiedAt: verifiedRows?.[0]?.last_verified_at ?? version.published_at,
      notice: NOTICE,
    };
  }
}
