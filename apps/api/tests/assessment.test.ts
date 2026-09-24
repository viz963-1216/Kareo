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
  freeText: "最近上下樓比較困難，家人白天需要上班。",
};

async function buildDeps(overrides: Partial<AssessmentServiceDeps> = {}) {
  const sessionRepo = new InMemorySessionRepository();
  const consentRepo = new InMemoryConsentRepository();
  const assessmentRepo = new InMemoryAssessmentRepository();
  const session = await sessionRepo.createSession();
  await consentRepo.createConsent({
    sessionId: session.id,
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
  return { deps, sessionRepo, consentRepo, assessmentRepo, logs, body: { ...validBody, sessionId: session.id } };
}

afterEach(() => vi.restoreAllMocks());

describe("Assessment service — session / consent gate", () => {
  it("creates an assessment with valid session + consent and stores knowledgeVersion, rulesVersion and ruleTrace", async () => {
    const { deps, body, assessmentRepo } = await buildDeps();
    const result = await createAssessment(deps, body);

    expect(result.assessment.id).toMatch(/^ASM-/);
    expect(result.assessment.status).toBe("COMPLETED");
    expect(result.assessment.knowledgeVersion).toBe("KB-FIXTURE-001");
    expect(result.assessment.rulesVersion).toBe(RULES_VERSION);
    expect(result.assessment.ruleTrace.templateIds).toContain("S-NEXT");
    expect(result.assessment.ruleTrace.knowledgeRecordIds.length).toBeGreaterThan(0);
    expect(assessmentRepo.assessments).toHaveLength(1);
    expect(assessmentRepo.careNeedProfiles).toHaveLength(1);
  });

  it("rejects an unknown session (CONSENT_REQUIRED) without loading knowledge or writing", async () => {
    const resolver: PublishedKnowledgeResolver = { resolvePublishedKnowledge: vi.fn() };
    const { deps, assessmentRepo } = await buildDeps({ knowledgeResolver: resolver });
    await expect(createAssessment(deps, { ...validBody, sessionId: "SES-DOES-NOT-EXIST" })).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
    expect(resolver.resolvePublishedKnowledge).not.toHaveBeenCalled();
    expect(assessmentRepo.assessments).toHaveLength(0);
  });

  it("rejects a session without consent (CONSENT_REQUIRED)", async () => {
    const sessionRepo = new InMemorySessionRepository();
    const session = await sessionRepo.createSession();
    const { deps } = await buildDeps({ sessionRepo, consentRepo: new InMemoryConsentRepository() });
    await expect(createAssessment(deps, { ...validBody, sessionId: session.id })).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
  });

  it("consent gate runs before field validation", async () => {
    const { deps } = await buildDeps();
    await expect(
      createAssessment(deps, { ...validBody, sessionId: "SES-NO-CONSENT", ageRange: "NOT_A_REAL_AGE_RANGE" })
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("session A's consent cannot be used by session B (consent is looked up per session)", async () => {
    const { deps, sessionRepo } = await buildDeps();
    const sessionB = await sessionRepo.createSession(); // 沒有同意
    await expect(createAssessment(deps, { ...validBody, sessionId: sessionB.id })).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
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
    const { deps, body } = await buildDeps();
    const result = await createAssessment(deps, { ...body, location });
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
    const { deps, body } = await buildDeps();
    const result = await createAssessment(deps, {
      ...body,
      location: { city: "臺北市", district: "大安區", precision: "GPS", lat: 25.033964, lng: 121.543681 },
    });
    expect(result.assessment.lat).toBe(25.034);
    expect(result.assessment.lng).toBe(121.544);
  });

  it("without any location the assessment still completes and stores null city/district", async () => {
    const { deps, body } = await buildDeps();
    const result = await createAssessment(deps, {
      ...body,
      location: { city: null, district: null, precision: "NONE", lat: null, lng: null },
    });
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
    const { deps, body, assessmentRepo } = await buildDeps({ knowledgeResolver: new FakePublishedKnowledgeResolver(null) });
    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
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
    const { deps, body, assessmentRepo, logs } = await buildDeps({ knowledgeResolver: resolver });
    const err = await createAssessment(deps, body).catch((e) => e);
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
    const { deps, body, assessmentRepo, logs } = await buildDeps({
      knowledgeResolver: new DatabaseKnowledgeResolver(hanging, { timeoutMs: 20 }),
    });
    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    expect(logs).toContainEqual({ event: "KNOWLEDGE_LOAD_FAILED", reason: "KnowledgeTimeoutError" });
    expect(assessmentRepo.assessments).toHaveLength(0);
  });

  it("assessment write failure → INTERNAL_ERROR and neither table has a row (atomic write)", async () => {
    const { deps, body, assessmentRepo } = await buildDeps();
    assessmentRepo.failNextCreate = true;
    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
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
    const { deps, body } = await buildDeps({ knowledgeResolver: new DatabaseKnowledgeResolver(repo) });
    const result = await createAssessment(deps, {
      ...body,
      location: { city: "臺北市", district: "大安區", precision: "DISTRICT", lat: null, lng: null },
    });
    expect(result.assessment.knowledgeVersion).toBe(versionId);
    expect(result.careNeedProfile.summary).not.toContain("未審核");
    expect(result.careNeedProfile.summary).not.toContain("衝突的地方補助");
    expect(result.assessment.ruleTrace.knowledgeRecordIds).not.toContain("KREC-REVIEW");
    expect(result.careNeedProfile.summary).toContain(`平台知識版本 ${versionId}`);
  });

  it("after a version switch, earlier assessments keep their original knowledgeVersion; new ones cite the new version", async () => {
    const { repo, versionId: v1 } = await knowledgeRepoWithPublished();
    const { deps, body, assessmentRepo } = await buildDeps({ knowledgeResolver: new DatabaseKnowledgeResolver(repo) });
    const first = await createAssessment(deps, body);

    // 發布新版本：金額換成合成新值
    const next = packRecords().map((r) => ({ ...r, id: `${r.id}-V2` }));
    const amounts = next.find((r) => r.ruleData.type === "BENEFIT_AMOUNTS")!;
    amounts.ruleData.careAndProfessionalMonthly = { "2": 12345, "8": 67890 };
    for (const r of next) repo.records.push(toKnowledgeRecord(r, "APPROVED"));
    await new Promise((resolve) => setTimeout(resolve, 5)); // 讓版本號不同
    const { versionId: v2 } = await publishVersion(repo, { recordIds: next.map((r) => r.id), createdBy: "t", approvedBy: "t" });
    expect(v2).not.toBe(v1);

    const second = await createAssessment(deps, body);
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
    const { deps, body } = await buildDeps({ knowledgeResolver: new DatabaseKnowledgeResolver(repo) });
    await expect(createAssessment(deps, body)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
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
    const { deps, body } = await buildDeps({ knowledgeResolver: new FakePublishedKnowledgeResolver(knowledge), log: undefined });
    const result = await createAssessment(deps, {
      ...body,
      freeText: secret,
      location: { city: "臺北市", district: "大安區", precision: "GPS", lat: 25.033964, lng: 121.543681 },
    });
    const printed = JSON.stringify([...warn.mock.calls, ...log.mock.calls, ...error.mock.calls]);
    expect(warn).toHaveBeenCalled();
    for (const fragment of ["阿公", "0912345678", "傷口", "25.03", "121.54"]) expect(printed).not.toContain(fragment);
    expect(JSON.stringify(result.assessment.ruleTrace)).not.toContain("傷口");
    expect(result.careNeedProfile.summary).not.toContain("阿公");
  });

  it("response data never includes forbidden official fields", async () => {
    const { deps, body } = await buildDeps();
    const result = await createAssessment(deps, body);
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
