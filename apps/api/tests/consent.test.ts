import { describe, it, expect } from "vitest";
import { createConsent, validateCreateConsentInput } from "../src/services/consentService.js";
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
