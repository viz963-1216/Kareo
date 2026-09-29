// TASK-B-005 整合驗收（Jerry 委託修正第二輪第 4 項）：合成 session → Consent → B-010 Assessment
// （真正的 createAssessment，不是直接建構 KnowledgeRecord/Assessment fixture）→ 本 API
// （createRecommendation），涵蓋 NONE／CITY／DISTRICT 三種精度；驗證 token、跨 session
// NOT_FOUND、0／1／2／3 家、服務範圍與地址分離。先前因 #33（B-010）尚未合併 staging 而延後，
// 現在 #33 已合併，補上這項測試。全部使用合成資料，不連線任何真實資料庫。
import { describe, it, expect } from "vitest";
import { createAssessment } from "../src/services/assessmentService.js";
import { createRecommendation } from "../src/services/recommendationService.js";
import {
  InMemoryAssessmentRepository,
  InMemoryConsentRepository,
  InMemoryProviderRepository,
  InMemoryRecommendationRepository,
  InMemorySessionRepository,
} from "../src/repositories/inMemoryRepositories.js";
import { RuleBasedAssessmentEngine } from "../src/assessment/ruleBasedAssessmentEngine.js";
import { FakePublishedKnowledgeResolver } from "../src/adapters/knowledgeVersionResolver.js";
import { fixtureSnapshot } from "./fixtures/knowledgeFixture.js";
import type { AssessmentServiceDeps } from "../src/services/assessmentService.js";
import type { CreateAssessmentInput, Provider, ProviderService, ProviderServiceArea } from "../src/types/index.js";

const FIXED_NOW = () => new Date("2026-09-27T02:00:00Z"); // Asia/Taipei 2026-09-27

const BASE_BODY: Omit<CreateAssessmentInput, "sessionId" | "location"> = {
  ageRange: "75_84",
  livingSituation: "WITH_FAMILY",
  caregiverSituation: "FAMILY_LIMITED",
  mobilityLevel: "NEEDS_ASSISTANCE",
  dailyLivingLevel: "PARTIAL_ASSISTANCE",
  needs: { homeCare: "YES", medicalNursing: "UNKNOWN", assistiveDevice: "UNKNOWN", transportation: "UNKNOWN" },
  disabilityCertificate: "UNKNOWN",
  incomeCategory: "UNKNOWN",
  freeText: "整合驗收合成案例。",
};

// 完整的合成環境：Session → Consent → Assessment（真正走 assessmentService.createAssessment，
// 不是直接建構 Assessment fixture）共用同一個 InMemory 儲存，再交給 Recommendation 使用。
async function buildFullPipeline() {
  const sessionRepo = new InMemorySessionRepository();
  const consentRepo = new InMemoryConsentRepository();
  const assessmentRepo = new InMemoryAssessmentRepository();
  const providerRepo = new InMemoryProviderRepository();
  const recommendationRepo = new InMemoryRecommendationRepository();

  const created = await sessionRepo.createSession();
  await consentRepo.createConsent({
    sessionId: created.id,
    disclaimerVersion: "1.0",
    privacyVersion: "1.0",
    termsVersion: "1.0",
    accepted: true,
  });

  const assessmentDeps: AssessmentServiceDeps = {
    sessionRepo,
    consentRepo,
    assessmentRepo,
    aiAdapter: new RuleBasedAssessmentEngine(),
    knowledgeResolver: new FakePublishedKnowledgeResolver(fixtureSnapshot()),
    now: FIXED_NOW,
  };

  return {
    sessionRepo,
    consentRepo,
    assessmentRepo,
    providerRepo,
    recommendationRepo,
    assessmentDeps,
    recommendationDeps: { sessionRepo, assessmentRepo, providerRepo, recommendationRepo },
    sessionId: created.id,
    sessionToken: created.sessionToken,
  };
}

function seedProvider(
  providerRepo: InMemoryProviderRepository,
  p: Partial<Provider> & { id: string },
  areas: Array<{ city: string; district: string }>
): void {
  providerRepo.providers.push({
    name: "測試居家照顧中心",
    type: "HOME_CARE",
    address: "測試地址",
    city: p.city ?? "新北市",
    district: p.district ?? "三重區",
    lat: null,
    lng: null,
    phone: null,
    website: null,
    googleMapsUrl: "https://maps.google.com/?q=" + p.id,
    status: "ACTIVE",
    verified: false,
    createdAt: "2026-09-01T00:00:00+08:00",
    updatedAt: "2026-09-01T00:00:00+08:00",
    ...p,
  } as Provider);
  providerRepo.services.push({ id: `${p.id}-SVC`, providerId: p.id, serviceType: "HOME_CARE", active: true } satisfies ProviderService);
  areas.forEach((a, i) =>
    providerRepo.serviceAreas.push({
      id: `${p.id}-AREA-${i}`,
      providerId: p.id,
      city: a.city,
      district: a.district,
      active: true,
    } satisfies ProviderServiceArea)
  );
}

describe("B-005 integration: session → Consent → B-010 Assessment → Recommendation", () => {
  it("DISTRICT precision: real Assessment feeds the recommendation, DISTRICT_ROTATION, 2 providers", async () => {
    const env = await buildFullPipeline();
    const body: CreateAssessmentInput = {
      ...BASE_BODY,
      sessionId: env.sessionId,
      location: { city: "新北市", district: "三重區", precision: "DISTRICT", lat: null, lng: null },
    };
    const { assessment } = await createAssessment(env.assessmentDeps, body, env.sessionToken);
    expect(assessment.locationPrecision).toBe("DISTRICT");

    seedProvider(env.providerRepo, { id: "PROV-1" }, [{ city: "新北市", district: "三重區" }]);
    seedProvider(env.providerRepo, { id: "PROV-2" }, [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(
      env.recommendationDeps,
      { assessmentId: assessment.id, serviceType: "HOME_CARE" },
      env.sessionToken
    );
    expect(result.rankingType).toBe("DISTRICT_ROTATION");
    expect(result.locationPrecision).toBe("DISTRICT");
    expect(result.providers).toHaveLength(2);
    expect(result.providers.every((p) => p.distanceKm === null)).toBe(true);
  });

  it("CITY precision: real Assessment (district=null) feeds the recommendation, CITY_ROTATION", async () => {
    const env = await buildFullPipeline();
    const body: CreateAssessmentInput = {
      ...BASE_BODY,
      sessionId: env.sessionId,
      location: { city: "新北市", district: null, precision: "CITY", lat: null, lng: null },
    };
    const { assessment } = await createAssessment(env.assessmentDeps, body, env.sessionToken);
    expect(assessment.locationPrecision).toBe("CITY");
    expect(assessment.district).toBeNull(); // B-010 驗證：CITY 精度時 district 必須是 null。

    seedProvider(env.providerRepo, { id: "PROV-CITY-1" }, [{ city: "新北市", district: "板橋區" }]);

    const result = await createRecommendation(
      env.recommendationDeps,
      { assessmentId: assessment.id, serviceType: "HOME_CARE" },
      env.sessionToken
    );
    expect(result.rankingType).toBe("CITY_ROTATION");
    expect(result.locationPrecision).toBe("CITY");
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].reasons).toContain("服務範圍包含新北市部分行政區");
  });

  it("NONE precision: real Assessment (city/district=null) feeds the recommendation, NO_LOCATION with 0 providers", async () => {
    const env = await buildFullPipeline();
    const body: CreateAssessmentInput = {
      ...BASE_BODY,
      sessionId: env.sessionId,
      location: { city: null, district: null, precision: "NONE", lat: null, lng: null },
    };
    const { assessment } = await createAssessment(env.assessmentDeps, body, env.sessionToken);
    expect(assessment.locationPrecision).toBe("NONE");
    expect(assessment.city).toBeNull();

    // 即使刻意塞了一家 Provider，NONE 精度也不應該查詢／推薦任何單位。
    seedProvider(env.providerRepo, { id: "PROV-SHOULD-NOT-APPEAR" }, [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(
      env.recommendationDeps,
      { assessmentId: assessment.id, serviceType: "HOME_CARE" },
      env.sessionToken
    );
    expect(result.rankingType).toBe("NO_LOCATION");
    expect(result.providers).toEqual([]);
  });

  it("0 / 1 / 3 providers all succeed end-to-end with a real Assessment (DISTRICT precision)", async () => {
    for (const count of [0, 1, 3]) {
      const env = await buildFullPipeline();
      const body: CreateAssessmentInput = {
        ...BASE_BODY,
        sessionId: env.sessionId,
        location: { city: "臺北市", district: "大安區", precision: "DISTRICT", lat: null, lng: null },
      };
      const { assessment } = await createAssessment(env.assessmentDeps, body, env.sessionToken);

      for (let i = 0; i < count; i++) {
        seedProvider(env.providerRepo, { id: `PROV-N${count}-${i}`, city: "臺北市", district: "大安區" }, [
          { city: "臺北市", district: "大安區" },
        ]);
      }

      const result = await createRecommendation(
        env.recommendationDeps,
        { assessmentId: assessment.id, serviceType: "HOME_CARE" },
        env.sessionToken
      );
      expect(result.providers).toHaveLength(count);
    }
  });

  it("service area and address are independent: a provider addressed elsewhere is still recommended for its declared service area", async () => {
    const env = await buildFullPipeline();
    const body: CreateAssessmentInput = {
      ...BASE_BODY,
      sessionId: env.sessionId,
      location: { city: "新北市", district: "三重區", precision: "DISTRICT", lat: null, lng: null },
    };
    const { assessment } = await createAssessment(env.assessmentDeps, body, env.sessionToken);

    seedProvider(env.providerRepo, { id: "PROV-REMOTE", city: "臺北市", district: "中山區", address: "臺北市中山區某路1號" }, [
      { city: "新北市", district: "三重區" },
    ]);

    const result = await createRecommendation(
      env.recommendationDeps,
      { assessmentId: assessment.id, serviceType: "HOME_CARE" },
      env.sessionToken
    );
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].id).toBe("PROV-REMOTE");
  });

  it("cross-session assessmentId -> NOT_FOUND (does not reveal whether the assessment exists)", async () => {
    const envA = await buildFullPipeline();
    const bodyA: CreateAssessmentInput = {
      ...BASE_BODY,
      sessionId: envA.sessionId,
      location: { city: "新北市", district: "三重區", precision: "DISTRICT", lat: null, lng: null },
    };
    const { assessment } = await createAssessment(envA.assessmentDeps, bodyA, envA.sessionToken);

    // 另一個獨立 session（同一組 in-memory repo，模擬同一個部署但不同使用者）。
    const otherSession = await envA.sessionRepo.createSession();

    await expect(
      createRecommendation(envA.recommendationDeps, { assessmentId: assessment.id, serviceType: "HOME_CARE" }, otherSession.sessionToken)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("no / invalid session token -> SESSION_INVALID", async () => {
    const env = await buildFullPipeline();
    const body: CreateAssessmentInput = {
      ...BASE_BODY,
      sessionId: env.sessionId,
      location: { city: "新北市", district: "三重區", precision: "DISTRICT", lat: null, lng: null },
    };
    const { assessment } = await createAssessment(env.assessmentDeps, body, env.sessionToken);

    await expect(
      createRecommendation(env.recommendationDeps, { assessmentId: assessment.id, serviceType: "HOME_CARE" }, undefined)
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
    await expect(
      createRecommendation(env.recommendationDeps, { assessmentId: assessment.id, serviceType: "HOME_CARE" }, "forged-token")
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });
});
