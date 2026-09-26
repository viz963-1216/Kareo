import { describe, it, expect } from "vitest";
import { createRecommendation, haversineKm, stableRotationHash } from "../src/services/recommendationService.js";
import {
  InMemorySessionRepository,
  InMemoryAssessmentRepository,
  InMemoryProviderRepository,
  InMemoryRecommendationRepository,
} from "../src/repositories/inMemoryRepositories.js";
import type { Assessment, Provider, ProviderService, ProviderServiceArea } from "../src/types/index.js";

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
    homeCareNeed: "YES",
    medicalNursingNeed: "UNKNOWN",
    assistiveDeviceNeed: "UNKNOWN",
    transportationNeed: "UNKNOWN",
    freeText: "",
    status: "COMPLETED",
    knowledgeVersion: "KB-2026-09-25-001",
    createdAt: "2026-09-25T10:00:00+08:00",
    updatedAt: "2026-09-25T10:00:00+08:00",
    ...overrides,
  };
}

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "PROV-001",
    name: "測試居家照顧中心",
    type: "HOME_CARE",
    address: "新北市三重區重新路一段100號",
    city: "新北市",
    district: "三重區",
    lat: null,
    lng: null,
    phone: "02-12345678",
    website: null,
    googleMapsUrl: "https://maps.google.com/x",
    status: "ACTIVE",
    verified: false,
    createdAt: "2026-09-01T00:00:00+08:00",
    updatedAt: "2026-09-01T00:00:00+08:00",
    ...overrides,
  };
}

interface Fixture {
  sessionRepo: InMemorySessionRepository;
  assessmentRepo: InMemoryAssessmentRepository;
  providerRepo: InMemoryProviderRepository;
  recommendationRepo: InMemoryRecommendationRepository;
}

async function buildFixture(): Promise<Fixture & { sessionToken: string; sessionId: string }> {
  const sessionRepo = new InMemorySessionRepository();
  const assessmentRepo = new InMemoryAssessmentRepository();
  const providerRepo = new InMemoryProviderRepository();
  const recommendationRepo = new InMemoryRecommendationRepository();
  const created = await sessionRepo.createSession();
  return { sessionRepo, assessmentRepo, providerRepo, recommendationRepo, sessionToken: created.sessionToken, sessionId: created.id };
}

function seedProvider(
  fixture: Fixture,
  p: Provider,
  services: Array<{ serviceType: ProviderService["serviceType"]; active?: boolean }>,
  areas: Array<{ city: string; district: string; active?: boolean }>
): void {
  fixture.providerRepo.providers.push(p);
  services.forEach((s, i) => {
    fixture.providerRepo.services.push({
      id: `${p.id}-SVC-${i}`,
      providerId: p.id,
      serviceType: s.serviceType,
      active: s.active ?? true,
    } satisfies ProviderService);
  });
  areas.forEach((a, i) => {
    fixture.providerRepo.serviceAreas.push({
      id: `${p.id}-AREA-${i}`,
      providerId: p.id,
      city: a.city,
      district: a.district,
      active: a.active ?? true,
    } satisfies ProviderServiceArea);
  });
}

describe("createRecommendation: session and ownership (B-011a reuse)", () => {
  it("no / invalid token -> SESSION_INVALID", async () => {
    const f = await buildFixture();
    await expect(
      createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, undefined)
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
    await expect(
      createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, "forged-token")
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("assessmentId belonging to a different session -> NOT_FOUND (not FORBIDDEN, does not reveal existence)", async () => {
    const f = await buildFixture();
    const otherSession = await f.sessionRepo.createSession();
    f.assessmentRepo.assessments.push(assessment({ id: "ASM-OTHER", sessionId: otherSession.id }));

    await expect(
      createRecommendation(f, { assessmentId: "ASM-OTHER", serviceType: "HOME_CARE" }, f.sessionToken)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("unknown assessmentId -> NOT_FOUND", async () => {
    const f = await buildFixture();
    await expect(
      createRecommendation(f, { assessmentId: "ASM-NOPE", serviceType: "HOME_CARE" }, f.sessionToken)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("invalid serviceType (including TRANSPORTATION, which does not use this API) -> VALIDATION_ERROR", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    await expect(
      createRecommendation(f, { assessmentId: "ASM-001", serviceType: "TRANSPORTATION" }, f.sessionToken)
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("createRecommendation: DISTRICT precision -> DISTRICT_ROTATION", () => {
  it("0 / 1 / 2 / 3 candidates all succeed; 0 candidates is success:true with empty array, not an Error", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));

    const zero = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(zero.providers).toHaveLength(0);
    expect(zero.rankingType).toBe("DISTRICT_ROTATION");
    expect(zero.notice).toBe("目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。");

    for (let n = 1; n <= 3; n++) {
      seedProvider(f, provider({ id: `PROV-D${n}` }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
      const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
      expect(result.providers).toHaveLength(n);
      expect(result.providers.every((p) => p.distanceKm === null)).toBe(true);
    }
  });

  it("more than 3 eligible candidates -> capped at 3", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    for (let n = 1; n <= 5; n++) {
      seedProvider(f, provider({ id: `PROV-D${n}` }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    }
    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.providers).toHaveLength(3);
  });

  it("reasons and notice match the approved mock wording exactly (contracts/mock/recommendations/HOME_CARE.json)", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    seedProvider(f, provider(), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.providers[0].reasons).toEqual(["服務範圍包含三重區", "提供您需要的居家照顧服務"]);
    expect(result.notice).toBe(
      "目前依您提供的行政區推薦符合條件的服務單位。因尚未提供精確位置，此結果並非依實際距離排序。"
    );
    expect(result.locationPrecision).toBe("DISTRICT");
  });

  it("filters out inactive services, inactive service areas, INACTIVE providers, and non-matching district", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    seedProvider(f, provider({ id: "PROV-INACTIVE-SVC" }), [{ serviceType: "HOME_CARE", active: false }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-INACTIVE-AREA" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區", active: false }]);
    seedProvider(f, provider({ id: "PROV-INACTIVE-STATUS", status: "INACTIVE" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-WRONG-DISTRICT" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "板橋區" }]);
    seedProvider(f, provider({ id: "PROV-WRONG-SERVICE" }), [{ serviceType: "ASSISTIVE_DEVICE" }], [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.providers).toHaveLength(0);
  });

  it("address and service area are matched separately (provider addressed elsewhere can still serve this district, PRODUCT_SPEC §19)", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    seedProvider(
      f,
      provider({ id: "PROV-REMOTE-ADDRESS", city: "臺北市", district: "中山區", address: "臺北市中山區某路1號" }),
      [{ serviceType: "HOME_CARE" }],
      [{ city: "新北市", district: "三重區" }]
    );
    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].id).toBe("PROV-REMOTE-ADDRESS");
  });
});

describe("createRecommendation: CITY precision -> CITY_ROTATION (D-13a)", () => {
  it("matches any district within the city; seed excludes district; reasons/notice match the approved mock", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "CITY", district: "" }));
    seedProvider(f, provider({ id: "PROV-CITY-1" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-CITY-2" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "板橋區" }]);

    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.rankingType).toBe("CITY_ROTATION");
    expect(result.providers).toHaveLength(2);
    expect(result.providers[0].reasons).toEqual(["服務範圍包含新北市部分行政區", "提供您需要的居家照顧服務"]);
    expect(result.notice).toBe(
      "目前只依您提供的縣市推薦，並非依實際距離排序，也不代表能服務您所在的行政區。補充行政區後可取得更適合的推薦。"
    );
  });

  it("does not match providers whose service area is a different city", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "CITY", district: "" }));
    seedProvider(f, provider({ id: "PROV-OTHER-CITY" }), [{ serviceType: "HOME_CARE" }], [{ city: "臺北市", district: "中山區" }]);
    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.providers).toHaveLength(0);
  });
});

describe("createRecommendation: NONE precision -> NO_LOCATION (D-13b)", () => {
  it("returns success:true with empty providers and does not query the Provider repository at all", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "NONE", city: "", district: "" }));

    let queryCalls = 0;
    const countingProviderRepo: typeof f.providerRepo = new Proxy(f.providerRepo, {
      get(target, prop, receiver) {
        if (prop === "findEligibleForRecommendation") {
          queryCalls += 1;
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const result = await createRecommendation(
      { ...f, providerRepo: countingProviderRepo },
      { assessmentId: "ASM-001", serviceType: "HOME_CARE" },
      f.sessionToken
    );
    expect(result.rankingType).toBe("NO_LOCATION");
    expect(result.providers).toEqual([]);
    expect(result.notice).toBe("您尚未提供位置，因此無法推薦服務單位。提供縣市或行政區後，可以取得符合服務範圍的推薦。");
    expect(queryCalls).toBe(0);
  });
});

describe("createRecommendation: GPS/EXACT precision -> DISTANCE or D-13c fallback", () => {
  it("all candidates have verified coordinates -> DISTANCE, sorted near to far, distanceKm rounded to 1 decimal", async () => {
    const f = await buildFixture();
    // 三重區公所大約座標；候選距離遞增。
    f.assessmentRepo.assessments.push(
      assessment({ sessionId: f.sessionId, locationPrecision: "GPS", lat: 25.0632, lng: 121.4874 })
    );
    seedProvider(f, provider({ id: "PROV-FAR", lat: 25.15, lng: 121.55 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-NEAR", lat: 25.064, lng: 121.488 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-MID", lat: 25.08, lng: 121.5 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.rankingType).toBe("DISTANCE");
    expect(result.locationPrecision).toBe("GPS");
    expect(result.providers.map((p) => p.id)).toEqual(["PROV-NEAR", "PROV-MID", "PROV-FAR"]);
    expect(result.providers.every((p) => typeof p.distanceKm === "number")).toBe(true);
    // 只有 DISTANCE 才有「距離約 X 公里」，且 X 就是四捨五入到小數 1 位後的 distanceKm。
    for (const p of result.providers) {
      expect(p.reasons.at(-1)).toBe(`距離約 ${p.distanceKm} 公里`);
      expect(Number.isInteger(p.distanceKm! * 10)).toBe(true);
    }
  });

  it("same distance ties break by providerId ascending", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "GPS", lat: 25.0, lng: 121.0 }));
    // 對稱位移，理論上與原點距離相同（緯度/經度各自對稱）。
    seedProvider(f, provider({ id: "PROV-B", lat: 25.01, lng: 121.0 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-A", lat: 24.99, lng: 121.0 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.providers[0].distanceKm).toBe(result.providers[1].distanceKm);
    expect(result.providers.map((p) => p.id)).toEqual(["PROV-A", "PROV-B"]);
  });

  it("D-13c: any candidate missing verified coordinates -> whole batch falls back to DISTRICT_ROTATION, locationPrecision stays GPS/EXACT, distanceKm all null", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "GPS", lat: 25.06, lng: 121.48 }));
    seedProvider(f, provider({ id: "PROV-HAS-COORDS", lat: 25.06, lng: 121.48 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-NO-COORDS", lat: null, lng: null }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.rankingType).toBe("DISTRICT_ROTATION");
    expect(result.locationPrecision).toBe("GPS");
    expect(result.providers.every((p) => p.distanceKm === null)).toBe(true);
    expect(result.notice).toBe("部分服務單位尚無已確認的位置資料，本次改依您選擇的行政區推薦，並非依實際距離排序。");
  });

  it("EXACT precision with all coordinates present also uses DISTANCE", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "EXACT", lat: 25.06, lng: 121.48 }));
    seedProvider(f, provider({ id: "PROV-1", lat: 25.061, lng: 121.481 }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(result.rankingType).toBe("DISTANCE");
  });
});

describe("stable rotation (D-13f): reproducible, not pure random", () => {
  it("same session + same day -> identical top-3 order across repeated calls (not Math.random)", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    for (let n = 1; n <= 5; n++) {
      seedProvider(f, provider({ id: `PROV-R${n}` }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    }
    const first = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    const second = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(second.providers.map((p) => p.id)).toEqual(first.providers.map((p) => p.id));
  });

  it("different session (different seed) can produce a different order for the same candidates/day", async () => {
    const f = await buildFixture();
    const otherSession = await f.sessionRepo.createSession();
    f.assessmentRepo.assessments.push(assessment({ id: "ASM-001", sessionId: f.sessionId }));
    f.assessmentRepo.assessments.push(assessment({ id: "ASM-002", sessionId: otherSession.id }));
    for (let n = 1; n <= 6; n++) {
      seedProvider(f, provider({ id: `PROV-R${n}` }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    }
    const a = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    const b = await createRecommendation(f, { assessmentId: "ASM-002", serviceType: "HOME_CARE" }, otherSession.sessionToken);
    expect(a.providers.map((p) => p.id)).not.toEqual(b.providers.map((p) => p.id));
  });

  it("stableRotationHash: same inputs are deterministic; different date changes the hash; CITY_ROTATION seed omits district", () => {
    const a = stableRotationHash(["SES-1", "新北市", "三重區", "2026-09-26", "PROV-001"]);
    const b = stableRotationHash(["SES-1", "新北市", "三重區", "2026-09-26", "PROV-001"]);
    const differentDay = stableRotationHash(["SES-1", "新北市", "三重區", "2026-09-27", "PROV-001"]);
    const cityOnly = stableRotationHash(["SES-1", "新北市", null, "2026-09-26", "PROV-001"]);
    expect(a).toBe(b);
    expect(a).not.toBe(differentDay);
    expect(a).not.toBe(cityOnly);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("notice never claims proximity outside DISTANCE", () => {
  it("no rankingType's notice contains 最近 or 附近, except the DISTANCE case which never uses those words either", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId, locationPrecision: "CITY", district: "" }));
    seedProvider(f, provider(), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    const city = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);
    expect(city.notice).not.toMatch(/最近|附近/);

    const f2 = await buildFixture();
    f2.assessmentRepo.assessments.push(assessment({ sessionId: f2.sessionId, locationPrecision: "NONE", city: "", district: "" }));
    const none = await createRecommendation(f2, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f2.sessionToken);
    expect(none.notice).not.toMatch(/最近|附近/);
  });
});

describe("service type labels match the approved mock wording", () => {
  it("ASSISTIVE_DEVICE and HOME_MEDICAL_NURSING reasons match contracts/mock/recommendations/*.json", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    seedProvider(f, provider({ id: "PROV-AD", type: "ASSISTIVE_DEVICE" }), [{ serviceType: "ASSISTIVE_DEVICE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-HMN", type: "HOME_MEDICAL_NURSING" }), [{ serviceType: "HOME_MEDICAL_NURSING" }], [{ city: "新北市", district: "三重區" }]);

    const ad = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "ASSISTIVE_DEVICE" }, f.sessionToken);
    expect(ad.providers[0].reasons).toContain("提供您需要的輔具服務");

    const hmn = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_MEDICAL_NURSING" }, f.sessionToken);
    expect(hmn.providers[0].reasons).toContain("提供您需要的居家醫療與護理服務");
  });
});

describe("persistence: RecommendationRun / RecommendationItem are written (DATA_MODEL §20-21)", () => {
  it("writes one RecommendationRun and one RecommendationItem per returned provider, in rank order", async () => {
    const f = await buildFixture();
    f.assessmentRepo.assessments.push(assessment({ sessionId: f.sessionId }));
    seedProvider(f, provider({ id: "PROV-1" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);
    seedProvider(f, provider({ id: "PROV-2" }), [{ serviceType: "HOME_CARE" }], [{ city: "新北市", district: "三重區" }]);

    const result = await createRecommendation(f, { assessmentId: "ASM-001", serviceType: "HOME_CARE" }, f.sessionToken);

    expect(f.recommendationRepo.runs).toHaveLength(1);
    expect(f.recommendationRepo.runs[0]).toMatchObject({
      id: result.recommendationId,
      assessmentId: "ASM-001",
      serviceType: "HOME_CARE",
      rankingType: "DISTRICT_ROTATION",
      locationPrecision: "DISTRICT",
      knowledgeVersion: "KB-2026-09-25-001",
    });
    expect(f.recommendationRepo.items).toHaveLength(2);
    expect(f.recommendationRepo.items.map((i) => i.rank)).toEqual([1, 2]);
    expect(f.recommendationRepo.items.every((i) => i.recommendationRunId === result.recommendationId)).toBe(true);
  });
});

describe("haversineKm", () => {
  it("is zero for identical coordinates and symmetric", () => {
    expect(haversineKm(25.06, 121.48, 25.06, 121.48)).toBe(0);
    const a = haversineKm(25.06, 121.48, 25.1, 121.5);
    const b = haversineKm(25.1, 121.5, 25.06, 121.48);
    expect(a).toBeCloseTo(b, 10);
  });
});
