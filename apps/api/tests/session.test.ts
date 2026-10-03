import { describe, it, expect } from "vitest";
import { createSession, deleteSession } from "../src/services/sessionService.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import { InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";
import { hashSessionToken } from "../src/services/sessionSecurityService.js";

describe("Session", () => {
  it("creates a session successfully", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    expect(session.id).toMatch(/^SES-/);
    expect(session.createdAt).toBeTruthy();
    expect(repo.sessions).toHaveLength(1);
  });

  it("returns a response shape matching API_CONTRACT.md v0.2 (sessionId, sessionToken, createdAt, expiresAt)", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);
    const responseData = {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };

    expect(responseData).toEqual({
      sessionId: expect.any(String),
      sessionToken: expect.any(String),
      createdAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  // 依 ARCHITECTURE §20.1：至少 256 bits（32 bytes）密碼學隨機值，base64url 編碼後至少 43 字元。
  it("issues a token with at least 256 bits of entropy (not Math.random)", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    expect(session.sessionToken.length).toBeGreaterThanOrEqual(43);
    expect(session.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/); // base64url

    const other = await createSession(repo);
    expect(other.sessionToken).not.toBe(session.sessionToken);
  });

  it("stores only the token hash — the repository never exposes the plaintext token again after creation", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    const found = await repo.findByTokenHash(hashSessionToken(session.sessionToken));
    expect(found?.id).toBe(session.id);
    // Session（非 CreatedSession）型別上就不存在 sessionToken 欄位，findByTokenHash 不會回傳明文。
    expect((found as unknown as Record<string, unknown>).sessionToken).toBeUndefined();
  });

  it("a wrong token never matches a different session's hash", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    const found = await repo.findByTokenHash(hashSessionToken("a-completely-different-token"));
    expect(found).toBeNull();
    void session;
  });
});

// TASK-B-011b：DELETE /api/v1/session（API_CONTRACT §6 v0.2，PRIVACY_AND_RETENTION §6.1）。
describe("deleteSession", () => {
  it("marks the session DELETION_REQUESTED and returns a deletionScheduledBefore 7 days out", async () => {
    const repo = new InMemorySessionRepository();
    const created = await createSession(repo);

    const result = await deleteSession(repo, created.sessionToken);

    expect(result.sessionId).toBe(created.id);
    expect(result.status).toBe("DELETION_REQUESTED");
    const scheduled = new Date(result.deletionScheduledBefore).getTime();
    const createdMs = new Date(created.createdAt).getTime();
    expect(scheduled).toBeGreaterThan(createdMs + 6 * 24 * 60 * 60 * 1000);
    expect(scheduled).toBeLessThan(createdMs + 8 * 24 * 60 * 60 * 1000);
    expect(repo.sessions.find((s) => s.id === created.id)?.status).toBe("DELETION_REQUESTED");
  });

  it("invalidates the token immediately: the deleted session's token no longer passes requireValidSession", async () => {
    const repo = new InMemorySessionRepository();
    const created = await createSession(repo);
    await deleteSession(repo, created.sessionToken);

    await expect(deleteSession(repo, created.sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a missing or invalid token with SESSION_INVALID", async () => {
    const repo = new InMemorySessionRepository();
    await expect(deleteSession(repo, undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
    await expect(deleteSession(repo, "bogus-token")).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("immediately cancels the session's open Leads (USER_DELETED) and clears contact fields", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const repo = new InMemorySessionRepository(leadRepo);
    const created = await createSession(repo);
    leadRepo.leads.push({
      id: "LEAD-1",
      sessionId: created.id,
      assessmentId: "ASM-1",
      recommendationId: "REC-1",
      providerId: "PRV-1",
      serviceType: "HOME_CARE",
      contactName: "王小明",
      contactPhone: "0900000000",
      contactConsentAt: created.createdAt,
      idempotencyKey: "idem-1",
      status: "NEW",
      statusReason: null,
      assignedOperatorId: null,
      firstContactedAt: null,
      closedAt: null,
      createdAt: created.createdAt,
      updatedAt: created.createdAt,
    });

    const result = await deleteSession(repo, created.sessionToken);

    expect(result.status).toBe("DELETION_REQUESTED");
    const lead = leadRepo.leads.find((l) => l.id === "LEAD-1")!;
    expect(lead.status).toBe("CANCELLED");
    expect(lead.statusReason).toBe("USER_DELETED");
    expect(lead.contactName).toBeNull();
    expect(lead.contactPhone).toBeNull();
    expect(leadRepo.statusEvents).toHaveLength(1);
    expect(leadRepo.statusEvents[0]).toMatchObject({ leadId: "LEAD-1", toStatus: "CANCELLED", reasonCode: "USER_DELETED", operatorId: null });
  });

  it("CLOSED / CANCELLED Leads keep their status and get no event, but their contact fields are cleared immediately", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const repo = new InMemorySessionRepository(leadRepo);
    const created = await createSession(repo);
    for (const [id, status, statusReason] of [
      ["LEAD-CLOSED", "CLOSED", "CONNECTED"],
      ["LEAD-CANCELLED", "CANCELLED", "USER_CANCELLED"],
    ] as const) {
      leadRepo.leads.push({
        id,
        sessionId: created.id,
        assessmentId: "ASM-1",
        recommendationId: "REC-1",
        providerId: "PRV-1",
        serviceType: "HOME_CARE",
        contactName: "測試甲",
        contactPhone: "0900000000",
        contactConsentAt: created.createdAt,
        idempotencyKey: `idem-${id}`,
        status,
        statusReason,
        assignedOperatorId: null,
        firstContactedAt: created.createdAt,
        closedAt: created.createdAt,
        createdAt: created.createdAt,
        updatedAt: created.createdAt,
      });
    }

    await deleteSession(repo, created.sessionToken);

    const closed = leadRepo.leads.find((l) => l.id === "LEAD-CLOSED")!;
    const cancelled = leadRepo.leads.find((l) => l.id === "LEAD-CANCELLED")!;
    expect(closed.status).toBe("CLOSED");
    expect(closed.statusReason).toBe("CONNECTED");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.statusReason).toBe("USER_CANCELLED");
    for (const lead of [closed, cancelled]) {
      expect(lead.contactName).toBeNull();
      expect(lead.contactPhone).toBeNull();
    }
    expect(leadRepo.statusEvents).toHaveLength(0);
  });
});
