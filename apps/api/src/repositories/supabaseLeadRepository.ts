import { getSupabaseClient } from "./supabaseClient.js";
import type { LeadRepository } from "./types.js";
import type { InternalOperator, Lead, LeadAccessEvent, LeadStatus, LeadStatusEvent, ProviderServiceType } from "../types/index.js";
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
  async findBySessionAndIdempotencyKey(sessionId: string, idempotencyKey: string): Promise<Lead | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("session_id", sessionId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Lead，請稍後再試。", { cause: error });
    return data ? mapLead(data) : null;
  }

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

  async updateLeadStatus(input: {
    id: string;
    expectedStatus: LeadStatus;
    toStatus: LeadStatus;
    statusReason: string | null;
    firstContactedAt: string | null;
    closedAt: string | null;
    updatedAt: string;
  }): Promise<boolean> {
    const client = getSupabaseClient();
    const updates: Record<string, unknown> = {
      status: input.toStatus,
      status_reason: input.statusReason,
      updated_at: input.updatedAt,
    };
    if (input.firstContactedAt !== null) updates.first_contacted_at = input.firstContactedAt;
    if (input.closedAt !== null) updates.closed_at = input.closedAt;

    // Compare-and-set：where status = expectedStatus，避免兩位操作者同時改動（LEAD_OPERATIONS §3）。
    const { data, error } = await client
      .from("leads")
      .update(updates)
      .eq("id", input.id)
      .eq("status", input.expectedStatus)
      .select("id");
    if (error) throw new AppError("INTERNAL_ERROR", "無法更新 Lead 狀態，請稍後再試。", { cause: error });
    return (data ?? []).length > 0;
  }

  async insertStatusEvent(event: LeadStatusEvent): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from("lead_status_events").insert({
      id: event.id,
      lead_id: event.leadId,
      from_status: event.fromStatus,
      to_status: event.toStatus,
      reason_code: event.reasonCode,
      note: event.note,
      operator_id: event.operatorId,
      created_at: event.createdAt,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法寫入 Lead 狀態歷程，請稍後再試。", { cause: error });
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
