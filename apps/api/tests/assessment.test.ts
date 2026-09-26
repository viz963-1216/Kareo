import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAssessment, validateCreateAssessmentInput } from "../src/services/assessmentService.js";
import {
  InMemoryAssessmentRepository,
  InMemoryConsentRepository,
  InMemorySessionRepository,
} from "../src/repositories/inMemoryRepositories.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import { RuleBasedAssessmentEngine } from "../src/assessment/ruleBasedAssessmentEngine.js";
import { RULES_VERSION } from "../src/assessment/rules.js";
import {
  DatabaseKnowledgeResolver,
  FakePublishedKnowledgeResolver,
  type PublishedKnowledgeResolver,
} from "../src/adapters/knowledgeVersionResolver.js";
import { publishVersion } from "../src/services/knowledgeService.js";
import { AppError } from "../src/errors/AppError.js";
import type { AssessmentServiceDeps } from "../src/services/assessmentService.js";
import type { CreateAssessmentInput, KnowledgeRecord } from "../src/types/index.js";
import { fixtureSnapshot, packRecords } from "./fixtures/knowledgeFixture.js";

// 全部使用合成資料（SES-*、合成自由文字）與合成知識快照；不連線任何資料庫。
const FIXED_NOW = () => new Date("2026-09-24T02:00:00Z"); // Asia/Taipei 2026-09-24

const validBody: CreateAssessmentInput = {
  sessionId: "SES-TEST0001",
  ageRange: "75_84",
  location: { city: "新北市", district: "三重區", precision: "DISTRICT", lat: null, lng: null },
  livingSituation: "WITH_FAMILY",
  caregiverSituation: "FAMILY_LIMITED",
  mobilityLevel: "NEEDS_ASSISTANCE",
  dailyLivingLevel: "PARTIAL_ASSISTANCE",
  needs: { homeCare: "YES", medicalNursing: "UNKNOWN", assistiveDevice: "YES", transportation: "YES" },
  disabilityCertificate: "UNKNOWN",
  incomeCategory: "UNKNOWN",
  freeText: "最近上下樓比較困難，家人白天需要上班。",
};

async function buildDeps(overrides: Partial<AssessmentServiceDeps> = {}): Promise<{
  deps: AssessmentServiceDeps;
  sessionRepo: InMemorySessionRepository;
  consentRepo: InMemoryConsentRepository;
  assessmentRepo: InMemoryAssessmentRepository;
  logs: Record<string, string>[];
  sessionId: string;
  sessionToken: string;
  body: CreateAssessmentInput;
}> {
  const sessionRepo = new InMemorySessionRepository();
  const consentRepo = new InMemoryConsentRepository();
  const assessmentRepo = new InMemoryAssessmentRepository();
  const created = await sessionRepo.createSession();
  await consentRepo.createConsent({
    sessionId: created.id,
    disclaimerVersion: "1.0",
    privacyVersion: "1.0",
    termsVersion: "1.0",
    accepted: true,
  });
  const logs: Record<string, string>[] = [];
  const deps: AssessmentServiceDeps = {
    sessionRepo,
    consentRepo,
    assessmentRepo,
    aiAdapter: new RuleBasedAssessmentEngine(),
    knowledgeResolver: new FakePublishedKnowledgeResolver(fixtureSnapshot()),
    now: FIXED_NOW,
    log: (e) => logs.push(e),
    ...overrides,
  };

  return {
    deps,
    sessionRepo,
    consentRepo,
    assessmentRepo,
    logs,
    sessionId: created.id,
    sessionToken: created.sessionToken,
    body: { ...validBody, sessionId: created.id },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Assessment service — session / consent gate (TASK-B-011a)", () => {
  it("creates an assessment with valid session token + consent and stores knowledgeVersion, rulesVersion and ruleTrace", async () => {
    const { deps, body, sessionToken, assessmentRepo } = await buildDeps();
    const result = await createAssessment(deps, body, sessionToken);

    expect(result.assessment.id).toMatch(/^ASM-/);
    expect(result.assessment.status).toBe("COMPLETED");
    expect(result.assessment.knowledgeVersion).toBe("KB-FIXTURE-001");
    expect(result.assessment.rulesVersion).toBe(RULES_VERSION);
    expect(result.assessment.ruleTrace.templateIds).toContain("S-NEXT");
    expect(result.assessment.ruleTrace.knowledgeRecordIds.length).toBeGreaterThan(0);
    expect(assessmentRepo.assessments).toHaveLength(1);
    expect(assessmentRepo.careNeedProfiles).toHaveLength(1);
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

  it("rejects when session token is valid but has no consent (CONSENT_REQUIRED), without loading knowledge or writing", async () => {
    const resolver: PublishedKnowledgeResolver = { resolvePublishedKnowledge: vi.fn() };
    const { deps, sessionId, sessionToken, assessmentRepo } = await buildDeps({
      consentRepo: new InMemoryConsentRepository(), // 空的，沒有任何 Consent
      knowledgeResolver: resolver,
    });
    const body = { ...validBody, sessionId };

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(resolver.resolvePublishedKnowledge).not.toHaveBeenCalled();
    expect(assessmentRepo.assessments).toHaveLength(0);
  });

  it("rejects invalid input (missing ageRange) with VALIDATION_ERROR", async () => {
    const { deps, sessionId, sessionToken } = await buildDeps();
    const body = { ...validBody, sessionId, ageRange: undefined };

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("Consent Gate runs before full field validation (CONSENT_REQUIRED takes priority over invalid fields)", async () => {
    // 依 tasks/TASK-B-003.md + TASK-B-011a 流程：Valid Session Token -> Body sessionId 一致
    // -> Valid Consent Gate -> Assessment Input Validation。
    // Session token 有效但沒有 Consent 時，即使其餘欄位也不合法，仍必須回 CONSENT_REQUIRED，而不是 VALIDATION_ERROR。
    const { deps, sessionId, sessionToken } = await buildDeps({ consentRepo: new InMemoryConsentRepository() });
    const body = { ...validBody, sessionId, ageRange: "NOT_A_REAL_AGE_RANGE" };

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("a rejected consent submission (accepted=false) never allows an Assessment to proceed", async () => {
    // 對應 tasks/TASK-B-003.md Testing 第 3 項：accepted=false 不得通過。
    // 依 B-002 的 Consent 設計，accepted=false 的請求本來就不會建立 Consent 記錄，
    // 這裡驗證端對端行為：曾經送過 accepted=false 的 Session，之後嘗試 Assessment 仍應被 CONSENT_REQUIRED 擋下。
    const consentRepo = new InMemoryConsentRepository();
    const { deps, sessionId, sessionToken } = await buildDeps({ consentRepo });
    expect(consentRepo.consents).toHaveLength(0); // 模擬使用者送出 accepted=false：不會有任何紀錄。

    const body = { ...validBody, sessionId };
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("a withdrawn consent no longer counts as valid (CONSENT_REQUIRED)", async () => {
    const { deps, consentRepo, sessionId, sessionToken } = await buildDeps();
    const consent = consentRepo.consents.find((c) => c.sessionId === sessionId)!;
    consent.withdrawnAt = new Date().toISOString();

    const body = { ...validBody, sessionId };
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("session A's consent cannot be used by session B (consent is looked up per session)", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const sessionB = await sessionRepo.createSession(); // 沒有同意
    const body = { ...validBody, sessionId: sessionB.id };
    await expect(createAssessment(deps, body, sessionB.sessionToken)).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
  });

  it("validateCreateAssessmentInput rejects invalid enum values", () => {
    expect(() => validateCreateAssessmentInput({ ...validBody, mobilityLevel: "FLYING" })).toThrow(AppError);
  });

  it("the rule engine produces a valid CareNeedProfile with only allowed CareNeed enum values", async () => {
    const { deps, body, sessionToken } = await buildDeps();

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

  it("CareNeedProfile output never contains provider-related fields", async () => {
    const { deps, body, sessionToken } = await buildDeps();
    const result = await createAssessment(deps, body, sessionToken);
    expect(Object.keys(result.careNeedProfile).sort()).toEqual(
      ["id", "assessmentId", "careNeeds", "priority", "summary", "warnings", "createdAt"].sort()
    );
  });

  it("warnings always contain the mandatory preliminary-estimate disclaimer", async () => {
    const { deps, body, sessionToken } = await buildDeps();

    const result = await createAssessment(deps, body, sessionToken);

    expect(result.careNeedProfile.warnings).toEqual(
      expect.arrayContaining([
        "本結果僅為初步預估。",
        "實際資格、長照等級與補助仍需由正式長照評估確認。",
      ])
    );
  });

  it("creates assessment when a Published Knowledge Version is available", async () => {
    const { deps, body, sessionToken } = await buildDeps({
      knowledgeResolver: new FakePublishedKnowledgeResolver(fixtureSnapshot(undefined, "KB-TEST-002")),
    });

    const result = await createAssessment(deps, body, sessionToken);
    expect(result.assessment.knowledgeVersion).toBe("KB-TEST-002");
  });

  it("rejects with KNOWLEDGE_UNAVAILABLE when there is no Published Knowledge Version", async () => {
    const { deps, body, sessionToken } = await buildDeps({
      knowledgeResolver: new FakePublishedKnowledgeResolver(null),
    });

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("propagates repository errors as-is for the function layer to convert into a safe INTERNAL_ERROR", async () => {
    const { deps, body, sessionToken, assessmentRepo } = await buildDeps();
    assessmentRepo.failNextCreate = true;

    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("response shape matches API_CONTRACT.md (assessmentId, knowledgeVersion, careNeedProfile)", async () => {
    const { deps, body, sessionToken } = await buildDeps();

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

describe("Assessment service — disabilityCertificate / incomeCategory (API_CONTRACT v0.3.1/v0.3.2, D-17/D-17a)", () => {
  it("T25: disabilityCertificate omitted → defaults to UNKNOWN (backward compatible, no error)", async () => {
    const { disabilityCertificate, ...bodyWithoutField } = validBody;
    void disabilityCertificate;
    const { deps, body, sessionToken } = await buildDeps();
    const { sessionId } = body;
    const result = await createAssessment(deps, { ...bodyWithoutField, sessionId }, sessionToken);
    expect(result.assessment.disabilityCertificate).toBe("UNKNOWN");
  });

  it("T31: disabilityCertificate = 'MAYBE' → VALIDATION_ERROR", async () => {
    const { deps, body, sessionToken } = await buildDeps();
    await expect(
      createAssessment(deps, { ...body, disabilityCertificate: "MAYBE" }, sessionToken)
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("T38: incomeCategory = 'RICH' → VALIDATION_ERROR", async () => {
    const { deps, body, sessionToken } = await buildDeps();
    await expect(createAssessment(deps, { ...body, incomeCategory: "RICH" }, sessionToken)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("incomeCategory omitted → defaults to UNKNOWN (backward compatible, no error)", async () => {
    const { incomeCategory, ...bodyWithoutField } = validBody;
    void incomeCategory;
    const { deps, body, sessionToken } = await buildDeps();
    const { sessionId } = body;
    const result = await createAssessment(deps, { ...bodyWithoutField, sessionId }, sessionToken);
    expect(result.assessment.incomeCategory).toBe("UNKNOWN");
  });
});

describe("Assessment service — location (API_CONTRACT v0.2.2 §8)", () => {
  const loc = (location: Record<string, unknown>) => ({ ...validBody, location });

  it.each([
    ["NONE", { city: null, district: null, precision: "NONE", lat: null, lng: null }],
    ["CITY", { city: "臺北市", district: null, precision: "CITY", lat: null, lng: null }],
    ["DISTRICT", { city: "新北市", district: "板橋區", precision: "DISTRICT", lat: null, lng: null }],
    ["GPS", { city: "臺北市", district: "大安區", precision: "GPS", lat: 25.0339, lng: 121.5436 }],
    ["EXACT", { city: "新北市", district: "三重區", precision: "EXACT", lat: 25.06, lng: 121.49 }],
  ])("accepts a valid %s location and completes the assessment", async (_name, location) => {
    const { deps, body, sessionToken } = await buildDeps();
    const result = await createAssessment(deps, { ...body, location }, sessionToken);
    expect(result.careNeedProfile.careNeeds.length).toBeGreaterThan(0);
  });

  it.each([
    ["NONE with a city", { city: "臺北市", district: null, precision: "NONE", lat: null, lng: null }],
    ["NONE with coordinates", { city: null, district: null, precision: "NONE", lat: 25, lng: 121 }],
    ["CITY without city", { city: null, district: null, precision: "CITY", lat: null, lng: null }],
    ["CITY with district", { city: "臺北市", district: "大安區", precision: "CITY", lat: null, lng: null }],
    ["DISTRICT without district", { city: "新北市", district: null, precision: "DISTRICT", lat: null, lng: null }],
    ["DISTRICT with coordinates", { city: "新北市", district: "三重區", precision: "DISTRICT", lat: 25, lng: 121 }],
    ["GPS without coordinates", { city: "臺北市", district: "大安區", precision: "GPS", lat: null, lng: null }],
    ["GPS lat out of range", { city: "臺北市", district: "大安區", precision: "GPS", lat: 95, lng: 121 }],
    ["city outside MVP area", { city: "桃園市", district: "中壢區", precision: "DISTRICT", lat: null, lng: null }],
    ["unsupported spelling", { city: "台北市", district: "大安區", precision: "DISTRICT", lat: null, lng: null }],
    ["missing lat/lng keys", { city: "新北市", district: "三重區", precision: "DISTRICT" }],
    ["unknown precision", { city: "新北市", district: "三重區", precision: "ROUGH", lat: null, lng: null }],
  ])("rejects %s with VALIDATION_ERROR", (_name, location) => {
    expect(() => validateCreateAssessmentInput(loc(location))).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
  });

  it("rejects a missing location object", () => {
    const { location: _omit, ...rest } = validBody;
    expect(() => validateCreateAssessmentInput(rest)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("rounds GPS/EXACT coordinates to 3 decimals before storing (D-13e proposal)", async () => {
    const { deps, body, sessionToken } = await buildDeps();
    const result = await createAssessment(
      deps,
      { ...body, location: { city: "臺北市", district: "大安區", precision: "GPS", lat: 25.033964, lng: 121.543681 } },
      sessionToken
    );
    expect(result.assessment.lat).toBe(25.034);
    expect(result.assessment.lng).toBe(121.544);
  });

  it("without any location the assessment still completes and stores null city/district", async () => {
    const { deps, body, sessionToken } = await buildDeps();
    const result = await createAssessment(
      deps,
      { ...body, location: { city: null, district: null, precision: "NONE", lat: null, lng: null } },
      sessionToken
    );
    expect(result.assessment.city).toBeNull();
    expect(result.assessment.district).toBeNull();
    expect(result.careNeedProfile.careNeeds).toEqual(["HOME_CARE", "ASSISTIVE_DEVICE", "TRANSPORTATION"]);
    expect(result.careNeedProfile.summary).not.toMatch(/臺北市長期照顧管理中心|新北市的地方補助/);
  });

  it("rejects invalid enum values", () => {
    expect(() => validateCreateAssessmentInput({ ...validBody, mobilityLevel: "FLYING" })).toThrow(AppError);
  });
});

describe("Assessment service — knowledge failures never produce a fake success or partial write", () => {
  it("T10: no PUBLISHED version → KNOWLEDGE_UNAVAILABLE, nothing written", async () => {
    const { deps, body, sessionToken, assessmentRepo } = await buildDeps({
      knowledgeResolver: new FakePublishedKnowledgeResolver(null),
    });
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    expect(assessmentRepo.assessments).toHaveLength(0);
    expect(assessmentRepo.careNeedProfiles).toHaveLength(0);
  });

  it("knowledge database failure → KNOWLEDGE_UNAVAILABLE, nothing written, DB error text not exposed or logged", async () => {
    const leaky = 'relation "knowledge_records" does not exist at character 42 token=SYNTHETIC-NOT-A-SECRET';
    const resolver: PublishedKnowledgeResolver = {
      resolvePublishedKnowledge: async () => {
        throw new Error(leaky);
      },
    };
    const { deps, body, sessionToken, assessmentRepo, logs } = await buildDeps({ knowledgeResolver: resolver });
    const err = await createAssessment(deps, body, sessionToken).catch((e) => e);
    expect(err).toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    expect(err.message).not.toContain("knowledge_records");
    expect(JSON.stringify(logs)).not.toContain("knowledge_records");
    expect(JSON.stringify(logs)).not.toContain("SYNTHETIC-NOT-A-SECRET");
    expect(assessmentRepo.assessments).toHaveLength(0);
  });

  it("knowledge timeout → KNOWLEDGE_UNAVAILABLE, nothing written", async () => {
    const hanging = {
      getCurrentPublishedStatus: () => new Promise<never>(() => {}),
      findPublishedSnapshotRecords: async () => [],
    };
    const { deps, body, sessionToken, assessmentRepo, logs } = await buildDeps({
      knowledgeResolver: new DatabaseKnowledgeResolver(hanging, { timeoutMs: 20 }),
    });
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    expect(logs).toContainEqual({ event: "KNOWLEDGE_LOAD_FAILED", reason: "KnowledgeTimeoutError" });
    expect(assessmentRepo.assessments).toHaveLength(0);
  });

  it("assessment write failure → INTERNAL_ERROR and neither table has a row (atomic write)", async () => {
    const { deps, body, sessionToken, assessmentRepo } = await buildDeps();
    assessmentRepo.failNextCreate = true;
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(assessmentRepo.assessments).toHaveLength(0);
    expect(assessmentRepo.careNeedProfiles).toHaveLength(0);
  });
});

describe("Assessment service — knowledge version binding (with the B-008 repository)", () => {
  function toKnowledgeRecord(r: ReturnType<typeof packRecords>[number], status: KnowledgeRecord["status"]): KnowledgeRecord {
    return {
      id: r.id,
      sourceId: `SRC-${r.authority}`,
      title: r.title,
      category: r.category,
      jurisdiction: r.jurisdiction,
      sourceUrl: "https://example.invalid/synthetic",
      publishedAt: null,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      fetchedAt: "2026-09-23T10:00:00+08:00",
      lastVerifiedAt: "2026-09-23T10:00:00+08:00",
      contentHash: "sha256:" + "0".repeat(64),
      status,
      version: null,
      rawText: "synthetic",
      summary: r.summary,
      ruleData: r.ruleData,
      createdAt: "2026-09-23T10:00:00+08:00",
      updatedAt: "2026-09-23T10:00:00+08:00",
      packId: "KP-SYNTHETIC",
      packRecordId: r.packRecordId,
    };
  }

  async function knowledgeRepoWithPublished() {
    const repo = new InMemoryKnowledgeRepository();
    for (const a of ["LAW", "MOHW", "TAIPEI_GOV"] as const) repo.sourceAuthorities.set(`SRC-${a}`, a);
    const records = packRecords();
    for (const r of records) repo.records.push(toKnowledgeRecord(r, "APPROVED"));
    const { versionId } = await publishVersion(repo, {
      recordIds: records.map((r) => r.id),
      createdBy: "test",
      approvedBy: "test",
    });
    return { repo, versionId };
  }

  it("uses only PUBLISHED records of the current version; NEEDS_REVIEW and CONFLICT records are never applied", async () => {
    const { repo, versionId } = await knowledgeRepoWithPublished();
    const base = packRecords()[0];
    repo.records.push(
      toKnowledgeRecord({ ...base, id: "KREC-REVIEW", packRecordId: "KR-9001", title: "未審核", jurisdiction: "TAIPEI", category: "BENEFIT", summary: "未審核的地方補助" }, "NEEDS_REVIEW"),
      toKnowledgeRecord({ ...base, id: "KREC-CONFLICT", packRecordId: "KR-9002", title: "衝突", jurisdiction: "TAIPEI", category: "BENEFIT", summary: "衝突的地方補助" }, "CONFLICT")
    );
    const { deps, body, sessionToken } = await buildDeps({ knowledgeResolver: new DatabaseKnowledgeResolver(repo) });
    const result = await createAssessment(
      deps,
      { ...body, location: { city: "臺北市", district: "大安區", precision: "DISTRICT", lat: null, lng: null } },
      sessionToken
    );
    expect(result.assessment.knowledgeVersion).toBe(versionId);
    expect(result.careNeedProfile.summary).not.toContain("未審核");
    expect(result.careNeedProfile.summary).not.toContain("衝突的地方補助");
    expect(result.assessment.ruleTrace.knowledgeRecordIds).not.toContain("KREC-REVIEW");
    expect(result.careNeedProfile.summary).toContain(`平台知識版本 ${versionId}`);
  });

  it("after a version switch, earlier assessments keep their original knowledgeVersion; new ones cite the new version", async () => {
    const { repo, versionId: v1 } = await knowledgeRepoWithPublished();
    const { deps, body, sessionToken, assessmentRepo } = await buildDeps({
      knowledgeResolver: new DatabaseKnowledgeResolver(repo),
    });
    const first = await createAssessment(deps, body, sessionToken);

    // 發布新版本：金額換成合成新值
    const next = packRecords().map((r) => ({ ...r, id: `${r.id}-V2` }));
    const amounts = next.find((r) => r.ruleData.type === "BENEFIT_AMOUNTS")!;
    amounts.ruleData.careAndProfessionalMonthly = { "2": 12345, "8": 67890 };
    for (const r of next) repo.records.push(toKnowledgeRecord(r, "APPROVED"));
    await new Promise((resolve) => setTimeout(resolve, 5)); // 讓版本號不同
    const { versionId: v2 } = await publishVersion(repo, { recordIds: next.map((r) => r.id), createdBy: "t", approvedBy: "t" });
    expect(v2).not.toBe(v1);

    const second = await createAssessment(deps, body, sessionToken);
    expect(first.assessment.knowledgeVersion).toBe(v1);
    expect(second.assessment.knowledgeVersion).toBe(v2);
    expect(assessmentRepo.assessments[0].knowledgeVersion).toBe(v1);
    expect(assessmentRepo.careNeedProfiles[0].summary).toContain("10,020");
    expect(second.careNeedProfile.summary).toContain("12,345");
    expect(second.careNeedProfile.summary).not.toContain("10,020");
  });

  it("a version that switches while loading is re-read, never mixed", async () => {
    const { repo, versionId } = await knowledgeRepoWithPublished();
    let calls = 0;
    const flaky = {
      getCurrentPublishedStatus: async () => {
        calls++;
        const status = await repo.getCurrentPublishedStatus();
        // 第一次讀取後、確認前，版本「看起來」切換過一次
        return calls === 2 && status ? { ...status, version: "KB-SWITCHED" } : status;
      },
      findPublishedSnapshotRecords: (v: string) => repo.findPublishedSnapshotRecords(v),
    };
    const snapshot = await new DatabaseKnowledgeResolver(flaky).resolvePublishedKnowledge();
    expect(snapshot?.version).toBe(versionId);
    expect(calls).toBe(4);

    const alwaysSwitching = {
      getCurrentPublishedStatus: async () => {
        calls++;
        return { version: `KB-${calls}`, publishedAt: "", lastVerifiedAt: "", notice: "" };
      },
      findPublishedSnapshotRecords: async () => [],
    };
    await expect(new DatabaseKnowledgeResolver(alwaysSwitching).resolvePublishedKnowledge()).rejects.toThrow();
  });

  it("withdrawn version with nothing republished → KNOWLEDGE_UNAVAILABLE", async () => {
    const { repo } = await knowledgeRepoWithPublished();
    await repo.withdrawCurrentVersion({ reason: "test", withdrawnBy: "test" });
    const { deps, body, sessionToken } = await buildDeps({ knowledgeResolver: new DatabaseKnowledgeResolver(repo) });
    await expect(createAssessment(deps, body, sessionToken)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });
});

describe("Assessment service — privacy of free text and logs", () => {
  it("free text never reaches logs, ruleTrace or summary", async () => {
    const secret = "阿公獨居，傷口換藥，電話0912345678";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // 使用預設 logger（console），並讓知識產生一筆診斷，確認診斷事件也不帶使用者資料。
    const knowledge = fixtureSnapshot((rs) => {
      (rs.find((r) => r.ruleData.type === "ELIGIBILITY_ANY_OF")!.ruleData.criteria as unknown[]).push({ code: "X_NEW" });
    });
    const { deps, body, sessionToken } = await buildDeps({
      knowledgeResolver: new FakePublishedKnowledgeResolver(knowledge),
      log: undefined,
    });
    const result = await createAssessment(
      deps,
      {
        ...body,
        freeText: secret,
        location: { city: "臺北市", district: "大安區", precision: "GPS", lat: 25.033964, lng: 121.543681 },
      },
      sessionToken
    );
    const printed = JSON.stringify([...warn.mock.calls, ...log.mock.calls, ...error.mock.calls]);
    expect(warn).toHaveBeenCalled();
    for (const fragment of ["阿公", "0912345678", "傷口", "25.03", "121.54"]) expect(printed).not.toContain(fragment);
    expect(JSON.stringify(result.assessment.ruleTrace)).not.toContain("傷口");
    expect(result.careNeedProfile.summary).not.toContain("阿公");
  });

  it("response data never includes forbidden official fields", async () => {
    const { deps, body, sessionToken } = await buildDeps();
    const result = await createAssessment(deps, body, sessionToken);
    const serialized = JSON.stringify(result.careNeedProfile);
    for (const field of ["officialCMSLevel", "officialEligibility", "approvedBenefit"]) expect(serialized).not.toContain(field);
  });
});

describe("production wiring (functions/assessment.ts)", () => {
  it("assembles the rule engine and the PUBLISHED knowledge resolver, never Fake/Null/fixture knowledge", () => {
    const source = readFileSync(fileURLToPath(new URL("../src/functions/assessment.ts", import.meta.url)), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(source).toContain("new RuleBasedAssessmentEngine()");
    expect(source).toContain("new DatabaseKnowledgeResolver(new SupabaseKnowledgeRepository())");
    for (const banned of ["Fake", "NullKnowledge", "fixture", "KP-2026"]) expect(source).not.toContain(banned);
  });

  it("the engine package has no AI/LLM dependency", () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(",");
    expect(deps).not.toMatch(/openai|anthropic|gemini|langchain|genai|mistral|cohere/i);
  });
});
