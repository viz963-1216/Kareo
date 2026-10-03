import { describe, it, expect } from "vitest";
import { createConsent, validateCreateConsentInput, withdrawConsent } from "../src/services/consentService.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import { InMemoryConsentRepository, InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";
import { FakeConsentVersionChecker } from "../src/services/consentVersionService.js";
import { AppError } from "../src/errors/AppError.js";

const ACTIVE_VERSIONS = { disclaimerVersion: "1.0", privacyVersion: "1.0", termsVersion: "1.0" };
const checker = new FakeConsentVersionChecker([ACTIVE_VERSIONS]);

async function seedSession() {
  const sessionRepo = new InMemorySessionRepository();
  const created = await sessionRepo.createSession();
  return { sessionRepo, sessionId: created.id, sessionToken: created.sessionToken };
}

describe("Consent", () => {
  it("creates consent when accepted=true and session token is valid", async () => {
    const { sessionRepo, sessionId, sessionToken } = await seedSession();
    const consentRepo = new InMemoryConsentRepository();
    const body = { sessionId, ...ACTIVE_VERSIONS, accepted: true };

    const consent = await createConsent(sessionRepo, consentRepo, checker, body, sessionToken);

    expect(consent.id).toMatch(/^CON-/);
    expect(consent.sessionId).toBe(sessionId);
    expect(consent.acceptedAt).toBeTruthy();
    expect(consent.withdrawnAt).toBeNull();
    expect(consentRepo.consents).toHaveLength(1);
  });

  it("rejects when accepted=false (not treated as valid consent)", async () => {
    const { sessionRepo, sessionId, sessionToken } = await seedSession();
    const consentRepo = new InMemoryConsentRepository();
    const body = { sessionId, ...ACTIVE_VERSIONS, accepted: false };

    await expect(createConsent(sessionRepo, consentRepo, checker, body, sessionToken)).rejects.toThrow(AppError);
    expect(consentRepo.consents).toHaveLength(0);
  });

  it("rejects without a session token, before touching the consent repository (SESSION_INVALID)", async () => {
    const sessionRepo = new InMemorySessionRepository();
    const consentRepo = new InMemoryConsentRepository();
    const body = { sessionId: "SES-X", ...ACTIVE_VERSIONS, accepted: true };

    await expect(createConsent(sessionRepo, consentRepo, checker, body, undefined)).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
    expect(consentRepo.consents).toHaveLength(0);
  });

  it("rejects when body sessionId does not match the token's session (FORBIDDEN)", async () => {
    const { sessionRepo, sessionToken } = await seedSession();
    const consentRepo = new InMemoryConsentRepository();
    const body = { sessionId: "SES-SOMEONE-ELSE", ...ACTIVE_VERSIONS, accepted: true };

    await expect(createConsent(sessionRepo, consentRepo, checker, body, sessionToken)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a version combination that is not ACTIVE", () => {
    expect(() =>
      validateCreateConsentInput(
        { sessionId: "SES-1", disclaimerVersion: "9.9", privacyVersion: "9.9", termsVersion: "9.9", accepted: true },
        checker
      )
    ).toThrow(AppError);
  });

  it("rejects when sessionId is missing", () => {
    const body = { ...ACTIVE_VERSIONS, sessionId: undefined, accepted: true };
    expect(() => validateCreateConsentInput(body, checker)).toThrow(AppError);
  });

  it("rejects invalid request body (not an object)", () => {
    expect(() => validateCreateConsentInput(null, checker)).toThrow(AppError);
    expect(() => validateCreateConsentInput("invalid", checker)).toThrow(AppError);
  });

  it("error has VALIDATION_ERROR code for missing fields", () => {
    try {
      validateCreateConsentInput({ sessionId: "SES-1" }, checker);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});

// TASK-B-011b：POST /api/v1/consent/withdraw（API_CONTRACT §7 v0.2，PRIVACY_AND_RETENTION §3.3）。
describe("withdrawConsent", () => {
  it("marks the active consent withdrawn and puts the session into DELETION_REQUESTED", async () => {
    const { sessionRepo, sessionId, sessionToken } = await seedSession();
    const consentRepo = new InMemoryConsentRepository(sessionRepo);
    await createConsent(sessionRepo, consentRepo, checker, { sessionId, ...ACTIVE_VERSIONS, accepted: true }, sessionToken);

    const result = await withdrawConsent(sessionRepo, consentRepo, sessionToken);

    expect(result.sessionStatus).toBe("DELETION_REQUESTED");
    expect(result.withdrawnAt).toBeTruthy();
    expect(consentRepo.consents[0].withdrawnAt).toBe(result.withdrawnAt);
  });

  it("the session's token is invalidated immediately: re-calling fails with SESSION_INVALID", async () => {
    const { sessionRepo, sessionId, sessionToken } = await seedSession();
    const consentRepo = new InMemoryConsentRepository(sessionRepo);
    await createConsent(sessionRepo, consentRepo, checker, { sessionId, ...ACTIVE_VERSIONS, accepted: true }, sessionToken);
    await withdrawConsent(sessionRepo, consentRepo, sessionToken);

    await expect(withdrawConsent(sessionRepo, consentRepo, sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects with SESSION_INVALID when there is no currently-active consent to withdraw", async () => {
    const { sessionRepo, sessionToken } = await seedSession();
    const consentRepo = new InMemoryConsentRepository(sessionRepo);

    await expect(withdrawConsent(sessionRepo, consentRepo, sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a missing or invalid session token with SESSION_INVALID", async () => {
    const consentRepo = new InMemoryConsentRepository();
    const sessionRepo = new InMemorySessionRepository();
    await expect(withdrawConsent(sessionRepo, consentRepo, undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("immediately cancels the session's open Leads (CONSENT_WITHDRAWN) and clears contact fields", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const sessionRepo = new InMemorySessionRepository(leadRepo);
    const consentRepo = new InMemoryConsentRepository(sessionRepo, leadRepo);
    const created = await sessionRepo.createSession();
    await createConsent(sessionRepo, consentRepo, checker, { sessionId: created.id, ...ACTIVE_VERSIONS, accepted: true }, created.sessionToken);
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
      status: "CONTACTED",
      statusReason: null,
      assignedOperatorId: "OP-1",
      firstContactedAt: created.createdAt,
      closedAt: null,
      createdAt: created.createdAt,
      updatedAt: created.createdAt,
    });

    await withdrawConsent(sessionRepo, consentRepo, created.sessionToken);

    const lead = leadRepo.leads.find((l) => l.id === "LEAD-1")!;
    expect(lead.status).toBe("CANCELLED");
    expect(lead.statusReason).toBe("CONSENT_WITHDRAWN");
    expect(lead.contactName).toBeNull();
    expect(lead.contactPhone).toBeNull();
    expect(leadRepo.statusEvents[0]).toMatchObject({ leadId: "LEAD-1", toStatus: "CANCELLED", reasonCode: "CONSENT_WITHDRAWN", operatorId: null });
  });

  it("CLOSED / CANCELLED Leads keep their status and get no event, but their contact fields are cleared immediately", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const sessionRepo = new InMemorySessionRepository(leadRepo);
    const consentRepo = new InMemoryConsentRepository(sessionRepo, leadRepo);
    const created = await sessionRepo.createSession();
    await createConsent(sessionRepo, consentRepo, checker, { sessionId: created.id, ...ACTIVE_VERSIONS, accepted: true }, created.sessionToken);
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

    await withdrawConsent(sessionRepo, consentRepo, created.sessionToken);

    const closed = leadRepo.leads.find((l) => l.id === "LEAD-CLOSED")!;
    const cancelled = leadRepo.leads.find((l) => l.id === "LEAD-CANCELLED")!;
    expect(closed.status).toBe("CLOSED");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.statusReason).toBe("USER_CANCELLED");
    for (const lead of [closed, cancelled]) {
      expect(lead.contactName).toBeNull();
      expect(lead.contactPhone).toBeNull();
    }
    expect(leadRepo.statusEvents).toHaveLength(0);
  });
});
