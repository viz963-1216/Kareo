// 測試用 Fake Repository，介面同 SupabaseLeadRepository，不得用於 Production。
import type { LeadRepository } from "./types.js";
import type { InternalOperator, Lead, LeadAccessEvent, LeadStatus, LeadStatusEvent, ProviderServiceType } from "../types/index.js";

const OPEN_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ACCEPTED"];

export class InMemoryLeadRepository implements LeadRepository {
  readonly leads: Lead[] = [];
  readonly statusEvents: LeadStatusEvent[] = [];
  readonly accessEvents: LeadAccessEvent[] = [];
  readonly operators: InternalOperator[] = [];

  async findBySessionAndIdempotencyKey(sessionId: string, idempotencyKey: string): Promise<Lead | null> {
    const found = this.leads.find((l) => l.sessionId === sessionId && l.idempotencyKey === idempotencyKey);
    return found ? { ...found } : null;
  }

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
    const idempotencyConflict = this.leads.some(
      (l) => l.sessionId === lead.sessionId && l.idempotencyKey === lead.idempotencyKey
    );
    const openDuplicate = this.leads.some(
      (l) =>
        l.sessionId === lead.sessionId &&
        l.providerId === lead.providerId &&
        l.serviceType === lead.serviceType &&
        OPEN_STATUSES.includes(l.status)
    );
    if (idempotencyConflict || openDuplicate) return { inserted: false };
    this.leads.push({ ...lead });
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

  async updateLeadStatus(input: {
    id: string;
    expectedStatus: LeadStatus;
    toStatus: LeadStatus;
    statusReason: string | null;
    firstContactedAt: string | null;
    closedAt: string | null;
    updatedAt: string;
  }): Promise<boolean> {
    const lead = this.leads.find((l) => l.id === input.id);
    if (!lead || lead.status !== input.expectedStatus) return false;
    lead.status = input.toStatus;
    lead.statusReason = input.statusReason;
    lead.updatedAt = input.updatedAt;
    if (input.firstContactedAt !== null) lead.firstContactedAt = input.firstContactedAt;
    if (input.closedAt !== null) lead.closedAt = input.closedAt;
    return true;
  }

  async insertStatusEvent(event: LeadStatusEvent): Promise<void> {
    this.statusEvents.push({ ...event });
  }

  async insertAccessEvent(event: LeadAccessEvent): Promise<void> {
    this.accessEvents.push({ ...event });
  }

  async findOperatorById(id: string): Promise<InternalOperator | null> {
    const found = this.operators.find((o) => o.id === id);
    return found ? { ...found } : null;
  }
}
