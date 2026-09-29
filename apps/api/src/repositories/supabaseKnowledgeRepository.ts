import { getSupabaseClient } from "./supabaseClient.js";
import type { KnowledgeRepository, PublishVersionInput } from "./types.js";
import type {
  KnowledgeAuthority,
  KnowledgeCategory,
  KnowledgeRecord,
  KnowledgeStatusResponse,
  Jurisdiction,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { nowTaipeiISOString } from "../lib/response.js";
import type { KnowledgeSnapshotRecord } from "../assessment/knowledgeSnapshot.js";

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
    content_fingerprint: r.contentFingerprint,
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
        "id, source_id, title, category, jurisdiction, source_url, published_at, effective_from, effective_to, fetched_at, last_verified_at, content_hash, content_fingerprint, status, version, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id"
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
      contentFingerprint: row.content_fingerprint,
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
        "id, source_id, title, category, jurisdiction, source_url, published_at, effective_from, effective_to, fetched_at, last_verified_at, content_hash, content_fingerprint, status, version, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id"
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
      contentFingerprint: data.content_fingerprint,
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

  // B-008-r3：只更新內容欄位，強制 status=NEEDS_REVIEW、version=null；WHERE 排除 status='PUBLISHED'
  // 當作最後一道防線（呼叫端理應已經檢查過，但不依賴呼叫端單一層防護）。
  async updateRecordContent(
    id: string,
    content: Omit<KnowledgeRecord, "id" | "createdAt" | "updatedAt" | "packId" | "packRecordId" | "status" | "version">
  ): Promise<void> {
    const client = getSupabaseClient();
    const { error, count } = await client
      .from("knowledge_records")
      .update(
        {
          source_id: content.sourceId,
          title: content.title,
          category: content.category,
          jurisdiction: content.jurisdiction,
          source_url: content.sourceUrl,
          published_at: content.publishedAt,
          effective_from: content.effectiveFrom,
          effective_to: content.effectiveTo,
          fetched_at: content.fetchedAt,
          last_verified_at: content.lastVerifiedAt,
          content_hash: content.contentHash,
          content_fingerprint: content.contentFingerprint,
          raw_text: content.rawText,
          summary: content.summary,
          rule_data: content.ruleData,
          status: "NEEDS_REVIEW",
          version: null,
          updated_at: nowTaipeiISOString(),
        },
        { count: "exact" }
      )
      .eq("id", id)
      .neq("status", "PUBLISHED");
    if (error) throw new AppError("INTERNAL_ERROR", "無法更新 Knowledge 紀錄內容，請稍後再試。", { cause: error });
    if (count === 0) {
      throw new AppError("INTERNAL_ERROR", `無法更新紀錄 ${id}：目前狀態為 PUBLISHED，不可用匯入覆寫已發布的歷史內容。`);
    }
  }

  // Jerry 委託修正第二輪（2026-09-27）：核准一律是單一 UPDATE，WHERE 同時檢查 status='NEEDS_REVIEW'
  // 「與」content_fingerprint = 呼叫端宣稱的預期值，兩者由 Postgres 在同一次操作內原子檢查——
  // 不是先 SELECT 讀出目前內容比對、再另外送一次 UPDATE（那樣兩次操作之間仍有競態空隙）。
  // 逐筆呼叫是因為每筆的 expectedContentFingerprint 可能不同，Supabase 的 update().eq() 無法一次
  // 對多筆套用「各自不同」的條件；每一筆呼叫本身仍是單一、原子的 SQL UPDATE 陳述式。
  async approveRecords(
    candidates: Array<{ id: string; expectedContentFingerprint: string }>
  ): Promise<{ approved: string[]; contentMismatched: string[] }> {
    if (candidates.length === 0) return { approved: [], contentMismatched: [] };
    const client = getSupabaseClient();
    const approved: string[] = [];
    const contentMismatched: string[] = [];

    for (const c of candidates) {
      const { data, error } = await client
        .from("knowledge_records")
        .update({ status: "APPROVED", updated_at: nowTaipeiISOString() })
        .eq("id", c.id)
        .eq("status", "NEEDS_REVIEW")
        .eq("content_fingerprint", c.expectedContentFingerprint)
        .select("id");
      if (error) throw new AppError("INTERNAL_ERROR", "無法核准 Knowledge 紀錄，請稍後再試。", { cause: error });
      if ((data ?? []).length > 0) {
        approved.push(c.id);
        continue;
      }
      // 沒有任何一列符合條件更新到：可能是狀態不對（已核准／已拒收／不存在），也可能是內容指紋不符
      // （核准與匯入之間內容被改變）。只有在「這筆紀錄目前確實是 NEEDS_REVIEW 但指紋不符」時才算
      // contentMismatched；其餘（狀態不對／不存在）不算，交給呼叫端用「原始清單 - 兩者」推得。
      const { data: current, error: currentError } = await client
        .from("knowledge_records")
        .select("status")
        .eq("id", c.id)
        .maybeSingle();
      if (currentError) throw new AppError("INTERNAL_ERROR", "無法核准 Knowledge 紀錄，請稍後再試。", { cause: currentError });
      if (current?.status === "NEEDS_REVIEW") contentMismatched.push(c.id);
    }

    return { approved, contentMismatched };
  }

  async versionExists(versionId: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client.from("knowledge_versions").select("id").eq("id", versionId).maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 版本，請稍後再試。");
    return data !== null;
  }

  async publishVersion(
    input: PublishVersionInput
  ): Promise<{ publishedRecordCount: number; supersededRecordCount: number; carriedForwardCount: number }> {
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
    const result = data as { publishedRecordCount: number; supersededRecordCount: number; carriedForwardCount: number };
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

  async getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null> {
    const client = getSupabaseClient();
    const { data: version, error: versionError } = await client
      .from("knowledge_versions")
      .select("id, published_at")
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (versionError) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 版本，請稍後再試。");
    if (!version) return null;

    // J-003-r5 K10：carry-forward 的紀錄保留原本的 version（不可變，第一次發布時的版本），
    // 不能再用 knowledge_records.version = 目前版本 查詢「目前這個版本包含哪些紀錄」——
    // 第二次發布後，這樣查詢只會拿到新發布的紀錄，carry-forward 進來的舊紀錄全部消失。
    // 改用 knowledge_version_records（migration 0012／原 0013）取得目前版本的完整紀錄成員。
    const { data: memberRows, error: memberError } = await client
      .from("knowledge_version_records")
      .select("knowledge_record_id")
      .eq("version_id", version.id);
    if (memberError) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 版本成員，請稍後再試。");
    const memberIds = (memberRows ?? []).map((r) => r.knowledge_record_id as string);

    const { data: verifiedRows, error: verifiedError } = memberIds.length
      ? await client
          .from("knowledge_records")
          .select("last_verified_at")
          .in("id", memberIds)
          .order("last_verified_at", { ascending: false })
          .limit(1)
      : { data: [], error: null };
    if (verifiedError) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 紀錄，請稍後再試。");

    return {
      version: version.id,
      publishedAt: version.published_at,
      lastVerifiedAt: verifiedRows?.[0]?.last_verified_at ?? version.published_at,
      notice: NOTICE,
    };
  }

  async findPublishedSnapshotRecords(versionId: string): Promise<KnowledgeSnapshotRecord[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .select(
        "id, pack_record_id, title, category, jurisdiction, effective_from, effective_to, summary, rule_data, knowledge_sources(authority)"
      )
      .eq("version", versionId)
      .eq("status", "PUBLISHED")
      .order("pack_record_id", { ascending: true });
    // 不把資料庫錯誤原文帶出（可能含 SQL / 結構資訊）。
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Knowledge 紀錄，請稍後再試。");
    return (data ?? []).map((row) => {
      const source = Array.isArray(row.knowledge_sources) ? row.knowledge_sources[0] : row.knowledge_sources;
      return {
        id: row.id,
        packRecordId: row.pack_record_id,
        title: row.title,
        category: row.category,
        jurisdiction: row.jurisdiction,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        summary: row.summary,
        ruleData: row.rule_data ?? {},
        authority: (source as { authority?: KnowledgeAuthority } | null)?.authority ?? null,
      };
    });
  }
}
