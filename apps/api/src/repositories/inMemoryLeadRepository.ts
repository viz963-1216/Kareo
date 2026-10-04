// 測試用 Fake Repository，介面同 SupabaseLeadRepository，不得用於 Production。
import type { AtomicLeadInput, LeadIdempotencyRecord, LeadRepository } from "./types.js";
import type { CreateLeadResult, InternalOperator, Lead, LeadAccessEvent, LeadStatus, LeadStatusEvent, ProviderServiceType } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

const OPEN_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ACCEPTED"];

interface StoredIdempotencyRecord extends LeadIdempotencyRecord {
  sessionId: string;
  idempotencyKey: string;
}

export class InMemoryLeadRepository implements LeadRepository {
  readonly leads: Lead[] = [];
  readonly statusEvents: LeadStatusEvent[] = [];
  readonly accessEvents: LeadAccessEvent[] = [];
  readonly operators: InternalOperator[] = [];
  readonly idempotencyRecords: StoredIdempotencyRecord[] = [];

  async createLeadAndRecord(input: AtomicLeadInput): Promise<CreateLeadResult> {
    // Test-only atomic model: no await between resolution and the two writes.
    // Session/consent race protection is verified against actual SQL separately.
    const record = this.idempotencyRecords.find(r => r.sessionId === input.lead.sessionId && r.idempotencyKey === input.lead.idempotencyKey);
    if (record && record.requestFingerprint !== input.requestFingerprint) {
      throw new AppError("IDEMPOTENCY_CONFLICT", "同一 Idempotency-Key 但內容不同。");
    }
    const existing = record ? this.leads.find(l => l.id === record.leadId)
      : this.leads.find(l => l.sessionId === input.lead.sessionId && l.providerId === input.lead.providerId && l.serviceType === input.lead.serviceType && OPEN_STATUSES.includes(l.status));
    if (record && !existing) throw new AppError("INTERNAL_ERROR", "無法建立 Lead，請稍後再試。");
    const chosen = existing ?? input.lead;
    const duplicate = record?.duplicate ?? Boolean(existing);
    if (!record) {
      if (!existing) this.leads.push({ ...input.lead });
      this.idempotencyRecords.push({ sessionId: input.lead.sessionId, idempotencyKey: input.lead.idempotencyKey, leadId: chosen.id, requestFingerprint: input.requestFingerprint, duplicate });
    }
    return { leadId: chosen.id, status: chosen.status, createdAt: chosen.createdAt, duplicate };
  }

  // 測試用：模擬 update_lead_status_with_event 這個 RPC 在事件寫入那一步失敗（同一交易應整個
  // 回滾），驗證狀態與 firstContactedAt/closedAt/updatedAt 都不會被改動（J-003-r8 問題 1）。
  failNextStatusEventInsert = false;

  async findOpenBySessionProviderService(
    sessionId: string,
    providerId: string,
    serviceType: ProviderServiceType
  ): Promise<Lead | null> {
    const found = this.leads.find(
      (l) =>
        l.sessionId === sessionId &&
        l.providerId === providerId &&
        l.serviceType === serviceType &&
        OPEN_STATUSES.includes(l.status)
    );
    return found ? { ...found } : null;
  }

  async insertLead(lead: Lead): Promise<{ inserted: boolean }> {
    const openDuplicate = this.leads.some(
      (l) =>
        l.sessionId === lead.sessionId &&
        l.providerId === lead.providerId &&
        l.serviceType === lead.serviceType &&
        OPEN_STATUSES.includes(l.status)
    );
    if (openDuplicate) return { inserted: false };
    this.leads.push({ ...lead });
    return { inserted: true };
  }

  async findIdempotencyRecord(sessionId: string, idempotencyKey: string): Promise<LeadIdempotencyRecord | null> {
    const found = this.idempotencyRecords.find((r) => r.sessionId === sessionId && r.idempotencyKey === idempotencyKey);
    return found ? { leadId: found.leadId, requestFingerprint: found.requestFingerprint, duplicate: found.duplicate } : null;
  }

  async insertIdempotencyRecord(input: {
    sessionId: string;
    idempotencyKey: string;
    leadId: string;
    requestFingerprint: string;
    duplicate: boolean;
  }): Promise<{ inserted: boolean }> {
    const exists = this.idempotencyRecords.some(
      (r) => r.sessionId === input.sessionId && r.idempotencyKey === input.idempotencyKey
    );
    if (exists) return { inserted: false };
    this.idempotencyRecords.push({ ...input });
    return { inserted: true };
  }

  async findById(id: string): Promise<Lead | null> {
    const found = this.leads.find((l) => l.id === id);
    return found ? { ...found } : null;
  }

  async listLeads(filter: { status: LeadStatus | null; since: string | null }): Promise<Lead[]> {
    return this.leads
      .filter((l) => (filter.status ? l.status === filter.status : true))
      .filter((l) => (filter.since ? l.createdAt >= filter.since : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((l) => ({ ...l }));
  }

  async claimLeadForReveal(leadId: string, operatorId: string): Promise<{ lead: Lead; assignedOperatorId: string } | null> {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) return null;
    if (lead.assignedOperatorId === null) lead.assignedOperatorId = operatorId;
    return { lead: { ...lead }, assignedOperatorId: lead.assignedOperatorId };
  }

  async insertAccessEvent(event: LeadAccessEvent): Promise<void> {
    this.accessEvents.push({ ...event });
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
    const lead = this.leads.find((l) => l.id === input.leadId);
    if (!lead || lead.status !== input.expectedStatus) return false;

    // 模擬 Postgres function 內 CAS UPDATE 與 INSERT lead_status_events 同一交易：先在副本上
    // 準備好全部要寫入的狀態，只有事件真的寫入成功後才套用到正式資料，任一步失敗則完全不變
    // （不是先改狀態、事件失敗才回滾——JS 物件變動不會自動回滾，必須先準備好再一次套用）。
    if (this.failNextStatusEventInsert) {
      this.failNextStatusEventInsert = false;
      throw new AppError("INTERNAL_ERROR", "模擬 LeadStatusEvent 寫入失敗（同一交易應整個回滾）。");
    }

    const fromStatus = lead.status;
    lead.status = input.toStatus;
    lead.statusReason = input.statusReason;
    lead.updatedAt = input.updatedAt;
    if (input.firstContactedAt !== null) lead.firstContactedAt = input.firstContactedAt;
    if (input.closedAt !== null) lead.closedAt = input.closedAt;

    this.statusEvents.push({
      id: input.event.id,
      leadId: lead.id,
      fromStatus,
      toStatus: input.toStatus,
      reasonCode: input.event.reasonCode,
      note: input.event.note,
      operatorId: input.event.operatorId,
      createdAt: input.updatedAt,
    });
    return true;
  }

  async findOperatorById(id: string): Promise<InternalOperator | null> {
    const found = this.operators.find((o) => o.id === id);
    return found ? { ...found } : null;
  }
}
