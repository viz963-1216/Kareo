import { describe, it, expect } from "vitest";
import { listLeads, revealContact, showLead, updateLeadStatus } from "../src/services/leadOperationsService.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import type { Lead } from "../src/types/index.js";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "LEAD-001",
    sessionId: "SES-001",
    assessmentId: "ASM-001",
    recommendationId: "REC-001",
    providerId: "PROV-001",
    serviceType: "HOME_CARE",
    contactName: "王先生",
    contactPhone: "0912345678",
    contactConsentAt: "2026-09-29T10:00:00+08:00",
    idempotencyKey: "11111111-1111-1111-1111-111111111111",
    status: "NEW",
    statusReason: null,
    assignedOperatorId: null,
    firstContactedAt: null,
    closedAt: null,
    createdAt: "2026-09-29T10:00:00+08:00",
    updatedAt: "2026-09-29T10:00:00+08:00",
    ...overrides,
  };
}

describe("listLeads / showLead", () => {
  it("never includes contactPhone", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());

    const listed = await listLeads(repo, { status: null, since: null });
    expect(listed[0]).not.toHaveProperty("contactPhone");
    expect(listed[0].contactName).toBe("王先生");

    const shown = await showLead(repo, "LEAD-001");
    expect(shown).not.toHaveProperty("contactPhone");
  });

  it("filters by status and since", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead({ id: "LEAD-A", status: "NEW", createdAt: "2026-09-28T10:00:00+08:00" }));
    repo.leads.push(lead({ id: "LEAD-B", status: "CONTACTED", createdAt: "2026-09-29T10:00:00+08:00" }));

    expect((await listLeads(repo, { status: "NEW", since: null })).map((l) => l.id)).toEqual(["LEAD-A"]);
    expect((await listLeads(repo, { status: null, since: "2026-09-29T00:00:00+08:00" })).map((l) => l.id)).toEqual([
      "LEAD-B",
    ]);
  });

  it("show throws NOT_FOUND for an unknown leadId", async () => {
    const repo = new InMemoryLeadRepository();
    await expect(showLead(repo, "LEAD-MISSING")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("revealContact", () => {
  it("returns the contact and writes a LeadAccessEvent", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());

    const contact = await revealContact(repo, "LEAD-001", "OP-001");

    expect(contact).toEqual({ name: "王先生", phone: "0912345678" });
    expect(repo.accessEvents).toHaveLength(1);
    expect(repo.accessEvents[0]).toMatchObject({ leadId: "LEAD-001", operatorId: "OP-001", action: "REVEAL_CONTACT" });
  });

  it("throws NOT_FOUND for an unknown leadId and does not write an access event", async () => {
    const repo = new InMemoryLeadRepository();
    await expect(revealContact(repo, "LEAD-MISSING", "OP-001")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repo.accessEvents).toHaveLength(0);
  });
});

describe("updateLeadStatus", () => {
  it("NEW -> CONTACTED succeeds without a reason code and sets firstContactedAt", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());

    const event = await updateLeadStatus(repo, { leadId: "LEAD-001", toStatus: "CONTACTED", reasonCode: null, note: null, operatorId: "OP-001" });

    expect(event).toMatchObject({ fromStatus: "NEW", toStatus: "CONTACTED" });
    expect(repo.leads[0].status).toBe("CONTACTED");
    expect(repo.leads[0].firstContactedAt).not.toBeNull();
    expect(repo.statusEvents).toHaveLength(1);
  });

  it("NEW -> CANCELLED without a reason code is rejected with VALIDATION_ERROR", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());
    await expect(
      updateLeadStatus(repo, { leadId: "LEAD-001", toStatus: "CANCELLED", reasonCode: null, note: null, operatorId: "OP-001" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("NEW -> CANCELLED with an invalid reason code is rejected with VALIDATION_ERROR", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());
    await expect(
      updateLeadStatus(repo, { leadId: "LEAD-001", toStatus: "CANCELLED", reasonCode: "NOT_A_CODE", note: null, operatorId: "OP-001" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("NEW -> CANCELLED with a valid reason code succeeds and sets closedAt", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());
    const event = await updateLeadStatus(repo, {
      leadId: "LEAD-001",
      toStatus: "CANCELLED",
      reasonCode: "UNREACHABLE",
      note: null,
      operatorId: "OP-001",
    });
    expect(event.reasonCode).toBe("UNREACHABLE");
    expect(repo.leads[0].status).toBe("CANCELLED");
    expect(repo.leads[0].closedAt).not.toBeNull();
  });

  it("ACCEPTED -> CLOSED with reason CONNECTED succeeds", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead({ status: "ACCEPTED" }));
    const event = await updateLeadStatus(repo, {
      leadId: "LEAD-001",
      toStatus: "CLOSED",
      reasonCode: "CONNECTED",
      note: null,
      operatorId: "OP-001",
    });
    expect(event.toStatus).toBe("CLOSED");
    expect(repo.leads[0].closedAt).not.toBeNull();
  });

  it("rejects an illegal jump (NEW -> ACCEPTED) with INVALID_STATUS_TRANSITION", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());
    await expect(
      updateLeadStatus(repo, { leadId: "LEAD-001", toStatus: "ACCEPTED", reasonCode: null, note: null, operatorId: "OP-001" })
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("rejects any transition out of a terminal status (CLOSED) with INVALID_STATUS_TRANSITION", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead({ status: "CLOSED", closedAt: "2026-09-29T10:00:00+08:00" }));
    await expect(
      updateLeadStatus(repo, { leadId: "LEAD-001", toStatus: "NEW", reasonCode: null, note: null, operatorId: "OP-001" })
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("throws NOT_FOUND for an unknown leadId", async () => {
    const repo = new InMemoryLeadRepository();
    await expect(
      updateLeadStatus(repo, { leadId: "LEAD-MISSING", toStatus: "CONTACTED", reasonCode: null, note: null, operatorId: "OP-001" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uses compare-and-set: a status changed between read and write is rejected with INVALID_STATUS_TRANSITION", async () => {
    const repo = new InMemoryLeadRepository();
    repo.leads.push(lead());
    // 模擬另一位操作者搶先把狀態改掉，讀取之後、寫入之前狀態已不同。
    const originalUpdate = repo.updateLeadStatus.bind(repo);
    repo.updateLeadStatus = async (input) => {
      repo.leads[0].status = "CANCELLED";
      repo.leads[0].closedAt = "2026-09-29T10:00:00+08:00";
      return originalUpdate(input);
    };

    await expect(
      updateLeadStatus(repo, { leadId: "LEAD-001", toStatus: "CONTACTED", reasonCode: null, note: null, operatorId: "OP-001" })
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });
});
