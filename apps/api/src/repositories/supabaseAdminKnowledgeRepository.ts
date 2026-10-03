import { getSupabaseClient } from "./supabaseClient.js";
import type { AdminKnowledgeRepository } from "./types.js";
import { AppError } from "../errors/AppError.js";
import { nowTaipeiISOString } from "../lib/response.js";
import type {
  AdminKnowledgeChangeSummary,
  AdminKnowledgeRecordSummary,
  AdminKnowledgeStatus,
  AdminPublishResult,
  AdminSession,
  CreatedAdminSession,
  InternalOperator,
  KnowledgeCategory,
  KnowledgeChangeStatus,
  KnowledgeRecordStatus,
  Jurisdiction,
  PublishPlan,
  RestorableVersionsResponse,
} from "../types/index.js";

function mapPlan(data: Record<string, unknown>): PublishPlan {
  return {
    canPublish: Boolean(data.canPublish),
    targetVersionId: (data.targetVersionId as string | null) ?? null,
    currentVersionId: (data.currentVersionId as string | null) ?? null,
    publishDate: data.publishDate as string,
    publishedRecordCount: data.publishedRecordCount as number,
    carriedForwardCount: data.carriedForwardCount as number,
    totalRecordCount: data.totalRecordCount as number,
    supersededRecordCount: data.supersededRecordCount as number,
    excludedRecordCount: data.excludedRecordCount as number,
    newRecords: ((data.newRecords as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: r.id as string,
      packId: r.packId as string,
      recordId: r.recordId as string,
      title: r.title as string,
      jurisdiction: r.jurisdiction as Jurisdiction,
      effectiveFrom: r.effectiveFrom as string,
      effectiveTo: (r.effectiveTo as string | null) ?? null,
    })),
    blockers: (data.blockers as PublishPlan["blockers"]) ?? [],
    previewToken: (data.previewToken as string | null) ?? null,
    generatedAt: data.generatedAt as string,
  };
}

function mapRecord(r: Record<string, unknown>): AdminKnowledgeRecordSummary {
  return {
    id: r.id as string,
    packId: r.pack_id as string,
    recordId: r.pack_record_id as string,
    title: r.title as string,
    jurisdiction: r.jurisdiction as Jurisdiction,
    category: r.category as KnowledgeCategory,
    sourceUrl: r.source_url as string,
    summary: r.summary as string,
    effectiveFrom: r.effective_from as string,
    effectiveTo: (r.effective_to as string | null) ?? null,
    contentFingerprint: r.content_fingerprint as string,
    status: r.status as KnowledgeRecordStatus,
  };
}

const RECORD_COLUMNS =
  "id, pack_id, pack_record_id, title, jurisdiction, category, source_url, summary, effective_from, effective_to, content_fingerprint, status, created_at";

function mapChange(c: Record<string, unknown>, sourceId: string): AdminKnowledgeChangeSummary {
  return {
    id: c.id as string,
    sourceId,
    detectedAt: c.detected_at as string,
    previousHash: (c.old_content_hash as string | null) ?? null,
    currentHash: c.new_content_hash as string,
    diffSummary: (c.ai_summary as string | null) ?? "偵測到內容變更，請比對 oldContent／newContent 原文確認。",
    status: c.status as KnowledgeChangeStatus,
  };
}

// STATE_CHANGED: 開頭是 migration 0019 admin_withdraw_knowledge_version／0020
// admin_publish_knowledge_version 拋出的約定字首，用來跟其他非預期的 SQL 錯誤區分
// （後者一律回安全的 INTERNAL_ERROR，不外露原文）。
function isStateChangedError(message: string | undefined): boolean {
  return typeof message === "string" && message.includes("STATE_CHANGED:");
}

// VALIDATION_ERROR: 開頭是 migration 0020 admin_publish_knowledge_version 在「取得鎖後重算仍有
// blocker」時拋出的約定字首（API_CONTRACT §26.9：重新計算後有 blocker → VALIDATION_ERROR，並
// 把給操作者看的 blocker message 原文帶回去，不是安全起見吞掉的通用 INTERNAL_ERROR）。
function extractValidationErrorMessage(message: string | undefined): string | null {
  if (typeof message !== "string") return null;
  const idx = message.indexOf("VALIDATION_ERROR:");
  if (idx === -1) return null;
  return message.slice(idx + "VALIDATION_ERROR:".length).trim();
}

export class SupabaseAdminKnowledgeRepository implements AdminKnowledgeRepository {
  async findOperatorById(id: string): Promise<InternalOperator | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("internal_operators")
      .select("id, display_name, roles, key_hash, active, created_at, revoked_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢操作者，請稍後再試。", { cause: error });
    if (!data) return null;
    return {
      id: data.id,
      displayName: data.display_name,
      roles: data.roles,
      keyHash: data.key_hash,
      active: data.active,
      createdAt: data.created_at,
      revokedAt: data.revoked_at,
    };
  }

  async createAdminSession(session: CreatedAdminSession & { tokenHash: string }): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from("admin_sessions").insert({
      id: session.id,
      operator_id: session.operatorId,
      token_hash: session.tokenHash,
      expires_at: session.expiresAt,
      created_at: session.createdAt,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法建立管理 Session，請稍後再試。", { cause: error });
  }

  async findAdminSessionByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("admin_sessions")
      .select("id, operator_id, expires_at, created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢管理 Session，請稍後再試。", { cause: error });
    if (!data) return null;
    return { id: data.id, operatorId: data.operator_id, expiresAt: data.expires_at, createdAt: data.created_at };
  }

  async getAdminKnowledgeStatus(): Promise<AdminKnowledgeStatus> {
    const client = getSupabaseClient();
    const { data: version, error: versionError } = await client
      .from("knowledge_versions")
      .select("id, published_at")
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (versionError) throw new AppError("INTERNAL_ERROR", "無法查詢知識狀態，請稍後再試。", { cause: versionError });

    const { data: run, error: runError } = await client
      .from("crawler_runs")
      .select("status, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runError) throw new AppError("INTERNAL_ERROR", "無法查詢 Crawler 執行紀錄，請稍後再試。", { cause: runError });

    return {
      publishedVersion: version?.id ?? null,
      publishedAt: version?.published_at ?? null,
      lastCrawlerRun: run ? { status: run.status, startedAt: run.started_at, finishedAt: run.finished_at } : null,
    };
  }

  async listChanges(status: string): Promise<AdminKnowledgeChangeSummary[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_changes")
      .select("id, knowledge_record_id, old_content_hash, new_content_hash, ai_summary, status, detected_at")
      .eq("status", status)
      .order("detected_at", { ascending: true });
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢知識變更，請稍後再試。", { cause: error });
    if (!data || data.length === 0) return [];

    const recordIds = [...new Set(data.map((c) => c.knowledge_record_id as string))];
    const { data: records, error: recordsError } = await client
      .from("knowledge_records")
      .select("id, source_id")
      .in("id", recordIds);
    if (recordsError) throw new AppError("INTERNAL_ERROR", "無法查詢知識變更，請稍後再試。", { cause: recordsError });
    const sourceIdByRecordId = new Map((records ?? []).map((r) => [r.id as string, r.source_id as string]));

    return data.map((c) => mapChange(c, sourceIdByRecordId.get(c.knowledge_record_id as string) ?? ""));
  }

  async listRecords(status: string): Promise<AdminKnowledgeRecordSummary[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_records")
      .select(RECORD_COLUMNS)
      .eq("status", status)
      .order("created_at", { ascending: true });
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢待審紀錄，請稍後再試。", { cause: error });
    return (data ?? []).map(mapRecord);
  }

  async findRecordById(id: string): Promise<AdminKnowledgeRecordSummary | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from("knowledge_records").select(RECORD_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢紀錄，請稍後再試。", { cause: error });
    return data ? mapRecord(data) : null;
  }

  async findChangeById(id: string): Promise<AdminKnowledgeChangeSummary | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("knowledge_changes")
      .select("id, knowledge_record_id, old_content_hash, new_content_hash, ai_summary, status, detected_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢變更，請稍後再試。", { cause: error });
    if (!data) return null;
    const { data: record, error: recordError } = await client
      .from("knowledge_records")
      .select("source_id")
      .eq("id", data.knowledge_record_id)
      .maybeSingle();
    if (recordError) throw new AppError("INTERNAL_ERROR", "無法查詢變更，請稍後再試。", { cause: recordError });
    return mapChange(data, record?.source_id ?? "");
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
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("admin_decide_knowledge_record", {
      payload: {
        recordId: input.recordId,
        decision: input.decision,
        reason: input.reason,
        expectedContentFingerprint: input.expectedContentFingerprint,
        operatorId: input.operatorId,
        auditId: input.auditId,
        now: input.now,
      },
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法處理核准／退回，請稍後再試。", { cause: error });
    if (!data?.updated) return { updated: false, record: null };

    const record = await this.findRecordById(input.recordId);
    return { updated: true, record };
  }

  async dismissChange(input: {
    changeId: string;
    reason: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ updated: boolean; change: AdminKnowledgeChangeSummary | null }> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("admin_dismiss_knowledge_change", {
      payload: {
        changeId: input.changeId,
        reason: input.reason,
        operatorId: input.operatorId,
        auditId: input.auditId,
        now: input.now,
      },
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法處理變更結案，請稍後再試。", { cause: error });
    if (!data?.updated) return { updated: false, change: null };

    const change = await this.findChangeById(input.changeId);
    return { updated: true, change };
  }

  async listRestorableVersions(): Promise<RestorableVersionsResponse> {
    const client = getSupabaseClient();
    const { data: current, error: currentError } = await client
      .from("knowledge_versions")
      .select("id, published_at")
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (currentError) throw new AppError("INTERNAL_ERROR", "無法查詢目前發布版本，請稍後再試。", { cause: currentError });

    const currentCountResult = current
      ? await client.from("knowledge_version_records").select("knowledge_record_id").eq("version_id", current.id)
      : null;
    if (currentCountResult?.error) {
      throw new AppError("INTERNAL_ERROR", "無法查詢版本內容數量，請稍後再試。", { cause: currentCountResult.error });
    }

    const currentVersion = current
      ? { versionId: current.id, publishedAt: current.published_at as string, recordCount: currentCountResult?.data?.length ?? 0 }
      : null;

    const { data: archived, error: archivedError } = await client
      .from("knowledge_versions")
      .select("id, published_at, approved_by, notes, withdrawn_at")
      .eq("status", "ARCHIVED")
      .order("published_at", { ascending: false });
    if (archivedError) throw new AppError("INTERNAL_ERROR", "無法查詢可恢復版本，請稍後再試。", { cause: archivedError });

    const candidates = (archived ?? []).filter((v) => v.id !== current?.id && v.withdrawn_at === null);
    if (candidates.length === 0) return { currentVersion, versions: [] };

    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const versions: RestorableVersionsResponse["versions"] = [];
    for (const v of candidates) {
      const { data: members, error: membersError } = await client
        .from("knowledge_version_records")
        .select("knowledge_record_id")
        .eq("version_id", v.id);
      if (membersError) throw new AppError("INTERNAL_ERROR", "無法查詢版本內容，請稍後再試。", { cause: membersError });
      if (!members || members.length === 0) continue;

      const memberIds = members.map((m) => m.knowledge_record_id as string);
      const { data: expired, error: expiredError } = await client
        .from("knowledge_records")
        .select("id")
        .in("id", memberIds)
        .not("effective_to", "is", null)
        .lt("effective_to", today)
        .limit(1);
      if (expiredError) throw new AppError("INTERNAL_ERROR", "無法查詢版本內容，請稍後再試。", { cause: expiredError });
      if (expired && expired.length > 0) continue;

      versions.push({
        versionId: v.id,
        publishedAt: v.published_at as string,
        approvedBy: (v.approved_by as string | null) ?? null,
        notes: (v.notes as string | null) ?? null,
        recordCount: memberIds.length,
      });
    }

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
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("admin_withdraw_knowledge_version", {
      payload: {
        withdrawVersionId: input.withdrawVersionId,
        republishVersionId: input.republishVersionId,
        reason: input.reason,
        operatorId: input.operatorId,
        auditId: input.auditId,
        now: input.now,
        today: input.today,
      },
    });
    if (error) {
      if (isStateChangedError(error.message)) return { stateChanged: true, republishedVersionId: null };
      throw new AppError("INTERNAL_ERROR", "無法撤回知識版本，請稍後再試。", { cause: error });
    }
    return { stateChanged: false, republishedVersionId: (data?.republishedVersionId as string | null) ?? null };
  }

  async computePublishPlan(): Promise<PublishPlan> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("compute_publish_plan");
    if (error) throw new AppError("INTERNAL_ERROR", "無法計算發布計畫，請稍後再試。", { cause: error });
    return mapPlan(data as Record<string, unknown>);
  }

  async adminPublish(input: {
    versionId: string;
    previewToken: string;
    operatorId: string;
    auditId: string;
    now: string;
  }): Promise<{ stateChanged: boolean; result: AdminPublishResult | null }> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("admin_publish_knowledge_version", {
      payload: {
        versionId: input.versionId,
        previewToken: input.previewToken,
        operatorId: input.operatorId,
        auditId: input.auditId,
        now: input.now,
      },
    });
    if (error) {
      if (isStateChangedError(error.message)) return { stateChanged: true, result: null };
      const validationMessage = extractValidationErrorMessage(error.message);
      if (validationMessage !== null) throw new AppError("VALIDATION_ERROR", validationMessage);
      throw new AppError("INTERNAL_ERROR", "無法發布知識版本，請稍後再試。", { cause: error });
    }
    const r = data as Record<string, unknown>;
    return {
      stateChanged: false,
      result: {
        versionId: r.versionId as string,
        publishedAt: r.publishedAt as string,
        publishedRecordCount: r.publishedRecordCount as number,
        carriedForwardCount: r.carriedForwardCount as number,
        totalRecordCount: ((r.publishedRecordCount as number) ?? 0) + ((r.carriedForwardCount as number) ?? 0),
        supersededRecordCount: r.supersededRecordCount as number,
        excludedRecordCount: 0,
      },
    };
  }
}
