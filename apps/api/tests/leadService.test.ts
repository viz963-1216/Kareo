import { describe, it, expect } from "vitest";
import { createLead } from "../src/services/leadService.js";
import {
  InMemorySessionRepository,
  InMemoryConsentRepository,
  InMemoryAssessmentRepository,
  InMemoryRecommendationRepository,
} from "../src/repositories/inMemoryRepositories.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import { AppError } from "../src/errors/AppError.js";
import type { Assessment, Lead, RecommendationItem, RecommendationRun } from "../src/types/index.js";

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: "ASM-001",
    sessionId: "SES-OWNER",
    ageRange: "75_84",
    city: "新北市",
    district: "三重區",
    locationPrecision: "DISTRICT",
    lat: null,
    lng: null,
    livingSituation: "WITH_FAMILY",
    caregiverSituation: "FAMILY_LIMITED",
    mobilityLevel: "NEEDS_ASSISTANCE",
    dailyLivingLevel: "PARTIAL_ASSISTANCE",
    disabilityCertificate: "UNKNOWN",
    incomeCategory: "UNKNOWN",
    homeCareNeed: "YES",
    medicalNursingNeed: "UNKNOWN",
    assistiveDeviceNeed: "UNKNOWN",
    transportationNeed: "UNKNOWN",
    freeText: "",
    status: "COMPLETED",
    knowledgeVersion: "KB-2026-09-25-001",
    rulesVersion: "RULES-TEST",
    ruleTrace: { needs: [], templateIds: [], knowledgeRecordIds: [] },
    createdAt: "2026-09-25T10:00:00+08:00",
    updatedAt: "2026-09-25T10:00:00+08:00",
    ...overrides,
  };
}

function run(overrides: Partial<RecommendationRun> = {}): RecommendationRun {
  return {
    id: "REC-001",
    assessmentId: "ASM-001",
    serviceType: "HOME_CARE",
    rankingType: "DISTRICT_ROTATION",
    locationPrecision: "DISTRICT",
    knowledgeVersion: "KB-2026-09-25-001",
    createdAt: "2026-09-25T10:05:00+08:00",
    ...overrides,
  };
}

function item(overrides: Partial<RecommendationItem> = {}): RecommendationItem {
  return {
    id: "RECI-001",
    recommendationRunId: "REC-001",
    providerId: "PROV-001",
    rank: 1,
    score: 100,
    distanceKm: null,
    reasons: ["r"],
    createdAt: "2026-09-25T10:05:00+08:00",
    ...overrides,
  };
}

interface Fixture {
  sessionRepo: InMemorySessionRepository;
  consentRepo: InMemoryConsentRepository;
  assessmentRepo: InMemoryAssessmentRepository;
  recommendationRepo: InMemoryRecommendationRepository;
  leadRepo: InMemoryLeadRepository;
}

async function buildFixture(): Promise<Fixture & { sessionToken: string; sessionId: string }> {
  const sessionRepo = new InMemorySessionRepository();
  const consentRepo = new InMemoryConsentRepository();
  const assessmentRepo = new InMemoryAssessmentRepository();
  const recommendationRepo = new InMemoryRecommendationRepository();
  const leadRepo = new InMemoryLeadRepository();
  const created = await sessionRepo.createSession();
  await consentRepo.createConsent({
    sessionId: created.id,
    disclaimerVersion: "v1",
    privacyVersion: "v1",
    termsVersion: "v1",
    accepted: true,
  });
  return { sessionRepo, consentRepo, assessmentRepo, recommendationRepo, leadRepo, sessionToken: created.sessionToken, sessionId: created.id };
}

function validBody(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    assessmentId: "ASM-001",
    recommendationId: "REC-001",
    providerId: "PROV-001",
    serviceType: "HOME_CARE",
    contact: { name: "王先生", phone: "0912345678" },
    contactConsent: true,
    ...overrides,
  };
}

async function seedAssessmentAndRun(fixture: Fixture, sessionId: string): Promise<void> {
  fixture.assessmentRepo.assessments.push(assessment({ sessionId }));
  fixture.recommendationRepo.runs.push(run());
  fixture.recommendationRepo.items.push(item());
}

describe("createLead", () => {
  it("creates a NEW lead when everything is valid", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);

    const result = await createLead(
      fixture,
      validBody(fixture.sessionId),
      fixture.sessionToken,
      "11111111-1111-1111-1111-111111111111"
    );

    expect(result.status).toBe("NEW");
    expect(result.duplicate).toBe(false);
    expect(fixture.leadRepo.leads).toHaveLength(1);
    expect(fixture.leadRepo.leads[0].contactName).toBe("王先生");
    expect(fixture.leadRepo.leads[0].contactPhone).toBe("0912345678");
  });

  it("rejects a missing or invalid session token with SESSION_INVALID", async () => {
    const fixture = await buildFixture();
    await expect(
      createLead(fixture, validBody(fixture.sessionId), "bad-token", "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("D-05 ①：撤回同意（session 轉 DELETION_REQUESTED）後，無法再送出新的 Lead（停止案件聯繫）", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    const session = fixture.sessionRepo.sessions.find((s) => s.id === fixture.sessionId)!;
    session.status = "DELETION_REQUESTED";

    await expect(
      createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a body sessionId that does not match the token's session with FORBIDDEN", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    await expect(
      createLead(fixture, validBody("SES-OTHER"), fixture.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a missing or malformed Idempotency-Key with VALIDATION_ERROR", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    await expect(createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, undefined)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "not-a-uuid")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects contactConsent !== true with VALIDATION_ERROR", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    await expect(
      createLead(
        fixture,
        validBody(fixture.sessionId, { contactConsent: false }),
        fixture.sessionToken,
        "11111111-1111-1111-1111-111111111111"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an invalid phone format with VALIDATION_ERROR", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    await expect(
      createLead(
        fixture,
        validBody(fixture.sessionId, { contact: { name: "王先生", phone: "123" } }),
        fixture.sessionToken,
        "11111111-1111-1111-1111-111111111111"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an empty contact name with VALIDATION_ERROR", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    await expect(
      createLead(
        fixture,
        validBody(fixture.sessionId, { contact: { name: "  ", phone: "0912345678" } }),
        fixture.sessionToken,
        "11111111-1111-1111-1111-111111111111"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects when the session has no active Consent with CONSENT_REQUIRED", async () => {
    const sessionRepo = new InMemorySessionRepository();
    const consentRepo = new InMemoryConsentRepository();
    const assessmentRepo = new InMemoryAssessmentRepository();
    const recommendationRepo = new InMemoryRecommendationRepository();
    const leadRepo = new InMemoryLeadRepository();
    const created = await sessionRepo.createSession();
    const fixture = { sessionRepo, consentRepo, assessmentRepo, recommendationRepo, leadRepo };
    assessmentRepo.assessments.push(assessment({ sessionId: created.id }));
    recommendationRepo.runs.push(run());
    recommendationRepo.items.push(item());

    await expect(
      createLead(fixture, validBody(created.id), created.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("returns NOT_FOUND when assessmentId does not exist", async () => {
    const fixture = await buildFixture();
    await expect(
      createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when assessmentId belongs to a different session", async () => {
    const fixture = await buildFixture();
    fixture.assessmentRepo.assessments.push(assessment({ sessionId: "SES-OTHER" }));
    fixture.recommendationRepo.runs.push(run());
    fixture.recommendationRepo.items.push(item());

    await expect(
      createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when recommendationId does not exist", async () => {
    const fixture = await buildFixture();
    fixture.assessmentRepo.assessments.push(assessment({ sessionId: fixture.sessionId }));

    await expect(
      createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when recommendationId belongs to a different assessment", async () => {
    const fixture = await buildFixture();
    fixture.assessmentRepo.assessments.push(assessment({ sessionId: fixture.sessionId }));
    fixture.recommendationRepo.runs.push(run({ assessmentId: "ASM-OTHER" }));
    fixture.recommendationRepo.items.push(item());

    await expect(
      createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a serviceType that does not match the recommendation run with VALIDATION_ERROR", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);

    await expect(
      createLead(
        fixture,
        validBody(fixture.sessionId, { serviceType: "ASSISTIVE_DEVICE" }),
        fixture.sessionToken,
        "11111111-1111-1111-1111-111111111111"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a providerId that is not in the recommendation result with VALIDATION_ERROR", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);

    await expect(
      createLead(
        fixture,
        validBody(fixture.sessionId, { providerId: "PROV-999" }),
        fixture.sessionToken,
        "11111111-1111-1111-1111-111111111111"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("replays the same result for the same session + Idempotency-Key + same content (duplicate: false)", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    const key = "11111111-1111-1111-1111-111111111111";

    const first = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, key);
    const second = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, key);

    expect(second.leadId).toBe(first.leadId);
    expect(second.duplicate).toBe(false);
    expect(fixture.leadRepo.leads).toHaveLength(1);
  });

  it("returns IDEMPOTENCY_CONFLICT for the same key with different content", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    const key = "11111111-1111-1111-1111-111111111111";

    await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, key);
    await expect(
      createLead(
        fixture,
        validBody(fixture.sessionId, { contact: { name: "王先生", phone: "0987654321" } }),
        fixture.sessionToken,
        key
      )
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(fixture.leadRepo.leads).toHaveLength(1);
  });

  it("returns the existing open lead (duplicate: true) for the same session+provider+serviceType with a different Idempotency-Key", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);

    const first = await createLead(
      fixture,
      validBody(fixture.sessionId),
      fixture.sessionToken,
      "11111111-1111-1111-1111-111111111111"
    );
    const second = await createLead(
      fixture,
      validBody(fixture.sessionId),
      fixture.sessionToken,
      "22222222-2222-2222-2222-222222222222"
    );

    expect(second.leadId).toBe(first.leadId);
    expect(second.duplicate).toBe(true);
    expect(fixture.leadRepo.leads).toHaveLength(1);
  });

  it("creates a new lead when the previous one for the same provider+serviceType is already terminal (CLOSED/CANCELLED)", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);

    const first = await createLead(
      fixture,
      validBody(fixture.sessionId),
      fixture.sessionToken,
      "11111111-1111-1111-1111-111111111111"
    );
    const lead = fixture.leadRepo.leads.find((l) => l.id === first.leadId) as Lead;
    lead.status = "CLOSED";

    const second = await createLead(
      fixture,
      validBody(fixture.sessionId),
      fixture.sessionToken,
      "22222222-2222-2222-2222-222222222222"
    );

    expect(second.leadId).not.toBe(first.leadId);
    expect(second.duplicate).toBe(false);
    expect(fixture.leadRepo.leads).toHaveLength(2);
  });

  it("recovers from a genuine insert race by re-querying instead of leaking the raw DB conflict", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    const key = "11111111-1111-1111-1111-111111111111";

    // 模擬 insertLead 因唯一約束衝突回 inserted=false，但呼叫端尚未查到既有紀錄的極端情境
    // （正常流程下這代表真正的併發競態）：先建立一筆，之後強迫 insertLead 回 false，
    // 驗證服務層會重新查詢並回傳既有結果，而不是把資料庫衝突原文往外拋。
    const originalInsert = fixture.leadRepo.insertLead.bind(fixture.leadRepo);
    let forceFail = false;
    fixture.leadRepo.insertLead = async (lead) => {
      if (forceFail) {
        forceFail = false;
        await originalInsert(lead);
        return { inserted: false };
      }
      return originalInsert(lead);
    };

    const result = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, key);
    expect(result.duplicate).toBe(false);

    forceFail = true;
    const raced = await createLead(
      fixture,
      validBody(fixture.sessionId),
      fixture.sessionToken,
      "22222222-2222-2222-2222-222222222222"
    );
    expect(raced.leadId).toBe(result.leadId);
    expect(raced.duplicate).toBe(true);
  });

  it("does not leak whether a mismatched AppError code slips through: unrelated errors still throw AppError, not raw errors", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    try {
      await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, "not-a-uuid");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });

  it("J-003-r8 #3: replays the same lead for a retried key even after the business-duplicate lead it resolved to has since closed", async () => {
    const fixture = await buildFixture();
    await seedAssessmentAndRun(fixture, fixture.sessionId);
    const keyA = "11111111-1111-1111-1111-111111111111";
    const keyB = "22222222-2222-2222-2222-222222222222";

    const first = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, keyA);
    // key B resolves to the same open lead as a business duplicate.
    const second = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, keyB);
    expect(second.leadId).toBe(first.leadId);
    expect(second.duplicate).toBe(true);

    // The lead closes out.
    const closedLead = fixture.leadRepo.leads.find((l) => l.id === first.leadId) as Lead;
    closedLead.status = "CLOSED";

    // Retrying key B again must still return the SAME lead (not create a second one), because key B
    // was already "used" even though it never directly inserted a lead of its own.
    const third = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, keyB);
    expect(third.leadId).toBe(first.leadId);
    expect(third.duplicate).toBe(true);
    expect(fixture.leadRepo.leads).toHaveLength(1);

    // Retrying key A again is unaffected and still returns the original lead with duplicate: false.
    const fourth = await createLead(fixture, validBody(fixture.sessionId), fixture.sessionToken, keyA);
    expect(fourth.leadId).toBe(first.leadId);
    expect(fourth.duplicate).toBe(false);
  });
});
