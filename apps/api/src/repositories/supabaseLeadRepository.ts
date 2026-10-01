import { getSupabaseClient } from "./supabaseClient.js";
import type { LeadIdempotencyRecord, LeadRepository } from "./types.js";
import type { InternalOperator, Lead, LeadAccessEvent, LeadStatus, ProviderServiceType } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

// Postgres unique_violation。依 ARCHITECTURE §20.5：唯一約束是防重複的最終防線，這裡只負責辨識
// 違反約束的情況並回傳 inserted=false，不把 SQL 錯誤細節往外拋。
const UNIQUE_VIOLATION = "23505";

function mapLead(data: Record<string, unknown>): Lead {
  return {
    id: data.id as string,
    sessionId: data.session_id as string,
    assessmentId: data.assessment_id as string,
    recommendationId: data.recommendation_id as string,
    providerId: data.provider_id as string,
    serviceType: data.service_type as ProviderServiceType,
    contactName: (data.contact_name as string | null) ?? null,
    contactPhone: (data.contact_phone as string | null) ?? null,
    contactConsentAt: data.contact_consent_at as string,
    idempotencyKey: data.idempotency_key as string,
    status: data.status as LeadStatus,
    statusReason: (data.status_reason as string | null) ?? null,
    assignedOperatorId: (data.assigned_operator_id as string | null) ?? null,
    firstContactedAt: (data.first_contacted_at as string | null) ?? null,
    closedAt: (data.closed_at as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

const LEAD_COLUMNS =
  "id, session_id, assessment_id, recommendation_id, provider_id, service_type, contact_name, contact_phone, contact_consent_at, idempotency_key, status, status_reason, assigned_operator_id, first_contacted_at, closed_at, created_at, updated_at";

export class SupabaseLeadRepository implements LeadRepository {
  async findOpenBySessionProviderService(
    sessionId: string,
    providerId: string,
    serviceType: ProviderServiceType
  ): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("session_id", sessionId)
      .eq("provider_id", providerId)
      .eq("service_type", serviceType)
      .not("status", "in", "(CLOSED,CANCELLED)")
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Lead，請稍後再試。", { cause: error });
    return data ? mapLead(data) : null;
  }

  async insertLead(lead: Lead): Promise<{ inserted: boolean }> {
    const client = getSupabaseClient();
    const { error } = await client.from("leads").insert({
      id: lead.id,
      session_id: lead.sessionId,
      assessment_id: lead.assessmentId,
      recommendation_id: lead.recommendationId,
      provider_id: lead.providerId,
      service_type: lead.serviceType,
      contact_name: lead.contactName,
      contact_phone: lead.contactPhone,
      contact_consent_at: lead.contactConsentAt,
      idempotency_key: lead.idempotencyKey,
      status: lead.status,
      status_reason: lead.statusReason,
      assigned_operator_id: lead.assignedOperatorId,
      first_contacted_at: lead.firstContactedAt,
      closed_at: lead.closedAt,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { inserted: false };
      throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。", { cause: error });
    }
    return { inserted: true };
  }

  async findIdempotencyRecord(sessionId: string, idempotencyKey: string): Promise<LeadIdempotencyRecord | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("lead_idempotency_records")
      .select("lead_id, request_fingerprint, duplicate")
      .eq("session_id", sessionId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Lead，請稍後再試。", { cause: error });
    if (!data) return null;
    return { leadId: data.lead_id, requestFingerprint: data.request_fingerprint, duplicate: data.duplicate };
  }

  async insertIdempotencyRecord(input: {
    sessionId: string;
    idempotencyKey: string;
    leadId: string;
    requestFingerprint: string;
    duplicate: boolean;
  }): Promise<{ inserted: boolean }> {
    const client = getSupabaseClient();
    const { error } = await client.from("lead_idempotency_records").insert({
      id: `${input.sessionId}:${input.idempotencyKey}`,
      session_id: input.sessionId,
      idempotency_key: input.idempotencyKey,
      lead_id: input.leadId,
      request_fingerprint: input.requestFingerprint,
      duplicate: input.duplicate,
      created_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { inserted: false };
      throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。", { cause: error });
    }
    return { inserted: true };
  }

  async findById(id: string): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Lead，請稍後再試。", { cause: error });
    return data ? mapLead(data) : null;
  }

  async listLeads(filter: { status: LeadStatus | null; since: string | null }): Promise<Lead[]> {
    const client = getSupabaseClient();
    let query = client.from("leads").select(LEAD_COLUMNS).order("created_at", { ascending: false });
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.since) query = query.gte("created_at", filter.since);
    const { data, error } = await query;
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Lead 清單，請稍後再試。", { cause: error });
    return (data ?? []).map(mapLead);
  }

  // 單一 UPDATE（COALESCE，只在 assigned_operator_id 為 null 時才真的寫入新值）內原子完成
  // 「若尚未指派則指派給這次呼叫的操作者，否則維持原指派對象」，由 Postgres 的 row-level lock
  // 保證併發下只有一個請求的指派會生效（LEAD_OPERATIONS §2、J-003-r8 問題 2）。REST `.update()`
  // 只能寫死值、無法表示 COALESCE 既有欄位值，改用 RPC。
  async claimLeadForReveal(leadId: string, operatorId: string): Promise<{ lead: Lead; assignedOperatorId: string } | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("claim_lead_for_reveal", {
      p_lead_id: leadId,
      p_operator_id: operatorId,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Lead，請稍後再試。", { cause: error });
    if (!data) return null;
    const lead = mapLead(data as Record<string, unknown>);
    return { lead, assignedOperatorId: lead.assignedOperatorId as string };
  }

  async insertAccessEvent(event: LeadAccessEvent): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from("lead_access_events").insert({
      id: event.id,
      lead_id: event.leadId,
      operator_id: event.operatorId,
      action: event.action,
      created_at: event.createdAt,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法寫入 Lead 存取紀錄，請稍後再試。", { cause: error });
  }

  async updateLeadStatusWithEvent(input: {
    leadId: string;
    expectedStatus: LeadStatus;
    toStatus: LeadStatus;
    statusReason: string | null;
    firstContactedAt: string | null;
    closedAt: string | null;
    updatedAt: string;
    event: { id: string; reasonCode: string | null; note: string | null; operatorId: string };
  }): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("update_lead_status_with_event", {
      payload: {
        leadId: input.leadId,
        expectedStatus: input.expectedStatus,
        toStatus: input.toStatus,
        statusReason: input.statusReason,
        firstContactedAt: input.firstContactedAt,
        closedAt: input.closedAt,
        updatedAt: input.updatedAt,
        eventId: input.event.id,
        operatorId: input.event.operatorId,
        reasonCode: input.event.reasonCode,
        note: input.event.note,
      },
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法更新 Lead 狀態，請稍後再試。", { cause: error });
    return Boolean((data as { updated?: boolean } | null)?.updated);
  }

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
}
