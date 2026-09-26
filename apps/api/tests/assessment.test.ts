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
  sessionId: string;
  sessionToken: string;
}> {
  const sessionRepo = new InMemorySessionRepository();
  const consentRepo = new InMemoryConsentRepository();
  const created = await sessionRepo.createSession();
  await consentRepo.createConsent({
    sessionId: created.id,
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

  return { deps, sessionRepo, consentRepo, sessionId: created.id, sessionToken: created.sessionToken };
}

describe("Assessment", () => {
  it("creates an assessment successfully with valid session token + consent", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps();
    const body = { ...validBody, sessionId };

    const result = await createAssessment(deps, body, sessionToken);

    expect(result.assessment.id).toMatch(/^ASM-/);
    expect(result.assessment.knowledgeVersion).toBe("KB-TEST-001");
    expect(result.careNeedProfile.id).toMatch(/^CNP-/);
  });

  it("rejects with no session token at all (SESSION_INVALID), before touching consent", async () => {
    const { deps } = await buildDeps();
    const body = { ...validBody, sessionId: "SES-DOES-NOT-EXIST" };

    await expect(createAssessment(deps, body, undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a forged/unknown session token (SESSION_INVALID)", async () => {
    const { deps, sessionId } = await buildDeps();
    const body = { ...validBody, sessionId };

    await expect(createAssessment(deps, body, "forged-token-that-does-not-exist")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects an expired session token (SESSION_INVALID)", async () => {
    const { deps, sessionRepo, sessionId, sessionToken } = await buildDeps();
    const session = sessionRepo.sessions.find((s) => s.id === sessionId)!;
    session.expiresAt = new Date(Date.now() - 1000).toISOString(); // 已過期

    const body = { ...validBody, sessionId };
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a token from a different, deleted/inactive session (SESSION_INVALID)", async () => {
    const { deps, sessionRepo, sessionId, sessionToken } = await buildDeps();
    const session = sessionRepo.sessions.find((s) => s.id === sessionId)!;
    session.status = "DELETED";

    const body = { ...validBody, sessionId };
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("session A's token cannot be used to act as session B (FORBIDDEN) — no cross-session access", async () => {
    const { deps, sessionToken } = await buildDeps(); // session A
    const otherSessionRepo = new InMemorySessionRepository();
    const sessionB = await otherSessionRepo.createSession(); // 不同的 session B

    const body = { ...validBody, sessionId: sessionB.id };
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects when session is valid but has no consent (CONSENT_REQUIRED)", async () => {
    const sessionRepo = new InMemorySessionRepository();
    const created = await sessionRepo.createSession();
    const deps: AssessmentServiceDeps = {
      sessionRepo,
      consentRepo: new InMemoryConsentRepository(), // 空的，沒有任何 Consent
      assessmentRepo: new InMemoryAssessmentRepository(),
      aiAdapter: new FakeAssessmentAIAdapter(),
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-001"),
    };
    const body = { ...validBody, sessionId: created.id };

    await expect(createAssessment(deps, body, created.sessionToken)).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
  });

  it("rejects invalid input (missing ageRange) with VALIDATION_ERROR", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps();
    const body = { ...validBody, sessionId, ageRange: undefined };

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("Consent Gate runs before full field validation (CONSENT_REQUIRED takes priority over invalid fields)", async () => {
    // 依 tasks/TASK-B-003.md + TASK-B-011a 流程：Valid Session Token -> Body sessionId 一致
    // -> Valid Consent Gate -> Assessment Input Validation。
    // Session 有效但沒有 Consent 時，即使其餘欄位也不合法，仍必須回 CONSENT_REQUIRED，而不是 VALIDATION_ERROR。
    const sessionRepo = new InMemorySessionRepository();
    const created = await sessionRepo.createSession();
    const deps: AssessmentServiceDeps = {
      sessionRepo,
      consentRepo: new InMemoryConsentRepository(),
      assessmentRepo: new InMemoryAssessmentRepository(),
      aiAdapter: new FakeAssessmentAIAdapter(),
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-001"),
    };
    const body = { ...validBody, sessionId: created.id, ageRange: "NOT_A_REAL_AGE_RANGE" };

    await expect(createAssessment(deps, body, created.sessionToken)).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
  });

  it("a rejected consent submission (accepted=false) never allows an Assessment to proceed", async () => {
    // 對應 tasks/TASK-B-003.md Testing 第 3 項：accepted=false 不得通過。
    // 依 B-002 的 Consent 設計，accepted=false 的請求本來就不會建立 Consent 記錄，
    // 這裡驗證端對端行為：曾經送過 accepted=false 的 Session，之後嘗試 Assessment 仍應被 CONSENT_REQUIRED 擋下。
    const sessionRepo = new InMemorySessionRepository();
    const consentRepo = new InMemoryConsentRepository();
    const created = await sessionRepo.createSession();

    // 模擬使用者送出 accepted=false：consentService 會拒絕，consentRepo 不會有任何紀錄。
    expect(consentRepo.consents).toHaveLength(0);

    const deps: AssessmentServiceDeps = {
      sessionRepo,
      consentRepo,
      assessmentRepo: new InMemoryAssessmentRepository(),
      aiAdapter: new FakeAssessmentAIAdapter(),
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-001"),
    };
    const body = { ...validBody, sessionId: created.id };

    await expect(createAssessment(deps, body, created.sessionToken)).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
  });

  it("a withdrawn consent no longer counts as valid (CONSENT_REQUIRED)", async () => {
    const sessionRepo = new InMemorySessionRepository();
    const consentRepo = new InMemoryConsentRepository();
    const created = await sessionRepo.createSession();
    const consent = await consentRepo.createConsent({
      sessionId: created.id,
      disclaimerVersion: "1.0",
      privacyVersion: "1.0",
      termsVersion: "1.0",
      accepted: true,
    });
    consentRepo.consents.find((c) => c.id === consent.id)!.withdrawnAt = new Date().toISOString();

    const deps: AssessmentServiceDeps = {
      sessionRepo,
      consentRepo,
      assessmentRepo: new InMemoryAssessmentRepository(),
      aiAdapter: new FakeAssessmentAIAdapter(),
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-001"),
    };
    const body = { ...validBody, sessionId: created.id };

    await expect(createAssessment(deps, body, created.sessionToken)).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
  });

  it("validateCreateAssessmentInput rejects invalid enum values", () => {
    expect(() => validateCreateAssessmentInput({ ...validBody, mobilityLevel: "FLYING" })).toThrow(AppError);
  });

  it("Fake AI Adapter produces a valid CareNeedProfile with only allowed CareNeed enum values", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps();
    const body = { ...validBody, sessionId };

    const result = await createAssessment(deps, body, sessionToken);
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
    const { deps, sessionId, sessionToken } = await buildDeps();
    const body = { ...validBody, sessionId };

    const result = await createAssessment(deps, body, sessionToken);

    expect(result.careNeedProfile.warnings).toEqual(
      expect.arrayContaining([
        "本結果僅為初步預估。",
        "實際資格、長照等級與補助仍需由正式長照評估確認。",
      ])
    );
  });

  it("creates assessment when a Published Knowledge Version is available", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps({
      knowledgeVersionResolver: new FakePublishedKnowledgeVersionResolver("KB-TEST-002"),
    });
    const body = { ...validBody, sessionId };

    const result = await createAssessment(deps, body, sessionToken);
    expect(result.assessment.knowledgeVersion).toBe("KB-TEST-002");
  });

  it("rejects with KNOWLEDGE_UNAVAILABLE when there is no Published Knowledge Version", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps({
      knowledgeVersionResolver: new NullKnowledgeVersionResolver(),
    });
    const body = { ...validBody, sessionId };

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("propagates repository errors as-is for the function layer to convert into a safe INTERNAL_ERROR", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps();
    deps.assessmentRepo = {
      createAssessment: async () => {
        throw new AppError("INTERNAL_ERROR", "模擬資料庫錯誤");
      },
    };
    const body = { ...validBody, sessionId };

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("response shape matches API_CONTRACT.md (assessmentId, knowledgeVersion, careNeedProfile)", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps();
    const body = { ...validBody, sessionId };

    const result = await createAssessment(deps, body, sessionToken);
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
