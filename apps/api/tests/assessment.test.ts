import { describe, it, expect } from "vitest";
import { createAssessment, validateCreateAssessmentInput } from "../src/services/assessmentService.js";
import {
  InMemoryAssessmentRepository,
  InMemoryConsentRepository,
  InMemorySessionRepository,
} from "../src/repositories/inMemoryRepositories.js";
import { FakeAssessmentAIAdapter } from "../src/adapters/fakeAssessmentAIAdapter.js";
import {
  FakePublishedKnowledgeVersionResolver,
  NullKnowledgeVersionResolver,
} from "../src/adapters/knowledgeVersionResolver.js";
import { AppError } from "../src/errors/AppError.js";
import type { AssessmentServiceDeps } from "../src/services/assessmentService.js";
import type { CreateAssessmentInput } from "../src/types/index.js";

const validBody: CreateAssessmentInput = {
  sessionId: "SES-TEST0001",
  ageRange: "75_84",
  location: { city: "新北市", district: "三重區", precision: "DISTRICT", lat: null, lng: null },
  livingSituation: "WITH_FAMILY",
  caregiverSituation: "FAMILY_LIMITED",
  mobilityLevel: "NEEDS_ASSISTANCE",
  dailyLivingLevel: "PARTIAL_ASSISTANCE",
  needs: { homeCare: "YES", medicalNursing: "UNKNOWN", assistiveDevice: "YES", transportation: "YES" },
  freeText: "最近上下樓比較困難，家人白天需要上班。",
};

async function buildDeps(overrides: Partial<AssessmentServiceDeps> = {}): Promise<{
  deps: AssessmentServiceDeps;
  sessionRepo: InMemorySessionRepository;
  consentRepo: InMemoryConsentRepository;
}> {
  const sessionRepo = new InMemorySessionRepository();
  const consentRepo = new InMemoryConsentRepository();
  const session = await sessionRepo.createSession();
  await consentRepo.createConsent({
    sessionId: session.id,
    disclaimerVersion: "1.0",
    privacyVersion: "1.0",
    termsVersion: "1.0",
    accepted: true,
  });

  const deps: AssessmentServiceDeps = {
    sessionRepo,
    consentRepo,
    assessmentRepo: new InMemoryAssessmentRepository(),
    aiAdapter: new FakeAssessmentAIAdapter(),
    knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-001"),
    ...overrides,
  };

  return { deps, sessionRepo, consentRepo };
}

describe("Assessment", () => {
  it("creates an assessment successfully with valid session + consent", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    const result = await createAssessment(deps, body);

    expect(result.assessment.id).toMatch(/^ASM-/);
    expect(result.assessment.knowledgeVersion).toBe("KB-TEST-001");
    expect(result.careNeedProfile.id).toMatch(/^CNP-/);
  });

  it("rejects when there is no session at all (CONSENT_REQUIRED)", async () => {
    const { deps } = await buildDeps();
    const body = { ...validBody, sessionId: "SES-DOES-NOT-EXIST" };

    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("rejects when session exists but has no consent (CONSENT_REQUIRED)", async () => {
    const sessionRepo = new InMemorySessionRepository();
    const session = await sessionRepo.createSession();
    const deps: AssessmentServiceDeps = {
      sessionRepo,
      consentRepo: new InMemoryConsentRepository(), // 空的，沒有任何 Consent
      assessmentRepo: new InMemoryAssessmentRepository(),
      aiAdapter: new FakeAssessmentAIAdapter(),
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-001"),
    };
    const body = { ...validBody, sessionId: session.id };

    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("rejects invalid input (missing ageRange) with VALIDATION_ERROR", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id, ageRange: undefined };

    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("validateCreateAssessmentInput rejects invalid enum values", () => {
    expect(() => validateCreateAssessmentInput({ ...validBody, mobilityLevel: "FLYING" })).toThrow(AppError);
  });

  it("Fake AI Adapter produces a valid CareNeedProfile with only allowed CareNeed enum values", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    const result = await createAssessment(deps, body);
    const allowed = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE", "TRANSPORTATION"];

    expect(result.careNeedProfile.careNeeds.length).toBeGreaterThan(0);
    for (const need of result.careNeedProfile.careNeeds) {
      expect(allowed).toContain(need);
    }
    // homeCare=YES, assistiveDevice=YES, transportation=YES → 三項應出現在 careNeeds 中
    expect(result.careNeedProfile.careNeeds).toEqual(
      expect.arrayContaining(["HOME_CARE", "ASSISTIVE_DEVICE", "TRANSPORTATION"])
    );
  });

  it("AI Adapter output never contains provider-related fields", async () => {
    const draft = await new FakeAssessmentAIAdapter().generateCareNeedProfile(validBody);
    expect(Object.keys(draft).sort()).toEqual(["careNeeds", "priority", "summary", "warnings"].sort());
  });

  it("warnings always contain the mandatory preliminary-estimate disclaimer", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    const result = await createAssessment(deps, body);

    expect(result.careNeedProfile.warnings).toEqual(
      expect.arrayContaining([
        "本結果僅為初步預估。",
        "實際資格、長照等級與補助仍需由正式長照評估確認。",
      ])
    );
  });

  it("creates assessment when a Published Knowledge Version is available", async () => {
    const { deps, sessionRepo } = await buildDeps({
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-002"),
    });
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    const result = await createAssessment(deps, body);
    expect(result.assessment.knowledgeVersion).toBe("KB-TEST-002");
  });

  it("rejects with KNOWLEDGE_UNAVAILABLE when there is no Published Knowledge Version", async () => {
    const { deps, sessionRepo } = await buildDeps({
      knowledgeVersionResolver: new NullKnowledgeVersionResolver(),
    });
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("propagates repository errors as-is for the function layer to convert into a safe INTERNAL_ERROR", async () => {
    const { deps, sessionRepo } = await buildDeps();
    deps.assessmentRepo = {
      createAssessment: async () => {
        throw new AppError("INTERNAL_ERROR", "模擬資料庫錯誤");
      },
    };
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("response shape matches API_CONTRACT.md (assessmentId, knowledgeVersion, careNeedProfile)", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const body = { ...validBody, sessionId: sessionRepo.sessions[0].id };

    const result = await createAssessment(deps, body);
    const responseData = {
      assessmentId: result.assessment.id,
      knowledgeVersion: result.assessment.knowledgeVersion,
      careNeedProfile: {
        id: result.careNeedProfile.id,
        careNeeds: result.careNeedProfile.careNeeds,
        priority: result.careNeedProfile.priority,
        summary: result.careNeedProfile.summary,
        warnings: result.careNeedProfile.warnings,
      },
    };

    expect(responseData).toEqual({
      assessmentId: expect.any(String),
      knowledgeVersion: expect.any(String),
      careNeedProfile: {
        id: expect.any(String),
        careNeeds: expect.any(Array),
        priority: expect.any(Array),
        summary: expect.any(String),
        warnings: expect.any(Array),
      },
    });
  });
});
