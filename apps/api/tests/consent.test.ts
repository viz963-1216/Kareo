import { describe, it, expect } from "vitest";
import { createConsent, validateCreateConsentInput } from "../src/services/consentService.js";
import { InMemoryConsentRepository } from "../src/repositories/inMemoryRepositories.js";
import { AppError } from "../src/errors/AppError.js";

const validBody = {
  sessionId: "SES-TEST0001",
  disclaimerVersion: "1.0",
  privacyVersion: "1.0",
  termsVersion: "1.0",
  accepted: true,
};

describe("Consent", () => {
  it("creates consent when accepted=true", async () => {
    const repo = new InMemoryConsentRepository();
    const consent = await createConsent(repo, validBody);

    expect(consent.id).toMatch(/^CON-/);
    expect(consent.sessionId).toBe(validBody.sessionId);
    expect(consent.acceptedAt).toBeTruthy();
    expect(repo.consents).toHaveLength(1);
  });

  it("rejects when accepted=false (not treated as valid consent)", async () => {
    const repo = new InMemoryConsentRepository();
    const body = { ...validBody, accepted: false };

    await expect(createConsent(repo, body)).rejects.toThrow(AppError);
    expect(repo.consents).toHaveLength(0);
  });

  it("rejects when sessionId is missing", () => {
    const body = { ...validBody, sessionId: undefined };
    expect(() => validateCreateConsentInput(body)).toThrow(AppError);
  });

  it("rejects invalid request body (not an object)", () => {
    expect(() => validateCreateConsentInput(null)).toThrow(AppError);
    expect(() => validateCreateConsentInput("invalid")).toThrow(AppError);
  });

  it("error has VALIDATION_ERROR code for missing fields", () => {
    try {
      validateCreateConsentInput({ sessionId: "SES-1" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});
