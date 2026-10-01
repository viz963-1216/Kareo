// TASK-B-013：GET /api/v1/providers，依 docs/API_CONTRACT.md §10a（v0.6，D-18、D-19）。
import { describe, it, expect } from "vitest";
import { lookupProviders } from "../src/services/providerLookupService.js";
import { InMemoryProviderRepository } from "../src/repositories/inMemoryRepositories.js";
import type { ProviderDatasetWrite } from "../src/repositories/types.js";

function provider(overrides: Partial<ProviderDatasetWrite["providers"][number]> = {}) {
  return {
    id: "PROV-001",
    name: "測試機構",
    type: "HOME_CARE" as const,
    resourceCategory: "SERVICE_PROVIDER" as const,
    address: "地址",
    city: "新北市",
    district: "三重區",
    lat: null,
    lng: null,
    phone: null,
    website: null,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=PROV-001",
    status: "ACTIVE" as const,
    verified: true,
    createdAt: "2026-09-01T00:00:00+08:00",
    updatedAt: "2026-09-01T00:00:00+08:00",
    ...overrides,
  };
}

// 比照 contracts/mock/providers/lookup 的情境建一份最小資料集：
// - PROV-001：新北市三重區，HOME_CARE，已驗證服務範圍涵蓋三重區
// - PROV-002：新北市三重區，ASSISTIVE_DEVICE，服務範圍待確認（UNCONFIRMED）
// - PROV-003：臺北市大安區，HOME_MEDICAL_NURSING，已驗證服務範圍只涵蓋臺北市信義區（不含三重區）
// - PROV-004：新北市蘆洲區，ASSISTIVE_DEVICE_CENTER（輔具資源中心，type=OTHER、無服務）
// - PROV-005：新北市三重區，ASSISTIVE_DEVICE，特約臺北市（contractRegions），服務範圍已驗證涵蓋三重區
async function seed(repo: InMemoryProviderRepository) {
  await repo.importDatasetAtomically({
    providers: [
      provider({ id: "PROV-001", name: "測試居家照顧中心" }),
      provider({ id: "PROV-002", name: "測試輔具商行", type: "ASSISTIVE_DEVICE" }),
      provider({
        id: "PROV-003",
        name: "測試居家護理所",
        type: "HOME_MEDICAL_NURSING",
        city: "臺北市",
        district: "大安區",
      }),
      provider({
        id: "PROV-004",
        name: "測試輔具資源中心",
        type: "OTHER",
        resourceCategory: "ASSISTIVE_DEVICE_CENTER",
        city: "新北市",
        district: "蘆洲區",
      }),
      provider({ id: "PROV-005", name: "測試特約輔具中心", type: "ASSISTIVE_DEVICE" }),
    ],
    services: [
      { id: "PSV-001", providerId: "PROV-001", serviceType: "HOME_CARE", active: true },
      { id: "PSV-002", providerId: "PROV-002", serviceType: "ASSISTIVE_DEVICE", active: true },
      { id: "PSV-003", providerId: "PROV-003", serviceType: "HOME_MEDICAL_NURSING", active: true },
      { id: "PSV-005", providerId: "PROV-005", serviceType: "ASSISTIVE_DEVICE", active: true },
    ],
    serviceAreas: [
      { id: "PSA-001", providerId: "PROV-001", city: "新北市", district: "三重區", active: true },
      { id: "PSA-003", providerId: "PROV-003", city: "臺北市", district: "信義區", active: true },
      { id: "PSA-005", providerId: "PROV-005", city: "新北市", district: "三重區", active: true },
    ],
    contractRegions: [
      { id: "PCR-005", providerId: "PROV-005", city: "臺北市", serviceType: "ASSISTIVE_DEVICE", sourceId: null, checkedAt: null, active: true },
    ],
  });
}

describe("lookupProviders", () => {
  it("no filters: returns all ACTIVE providers sorted by city → district → id", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);

    const result = await lookupProviders(repo, {});

    expect(result.items.map((i) => i.id)).toEqual(["PROV-003", "PROV-001", "PROV-002", "PROV-005", "PROV-004"]);
    expect(result.totalCount).toBe(5);
    expect(result.unconfirmedCount).toBeNull();
    expect(result.appliedFilters).toEqual({
      resourceCategory: null,
      serviceType: null,
      city: null,
      district: null,
      areaFilter: null,
      includeUnconfirmed: false,
      contractCity: null,
      q: null,
      page: 1,
      pageSize: 20,
    });
  });

  it("items contain only the documented 15 fields — no lat/lng/status/timestamps", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, {});

    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          "id",
          "name",
          "type",
          "resourceCategory",
          "services",
          "address",
          "city",
          "district",
          "phone",
          "website",
          "googleMapsUrl",
          "verified",
          "serviceAreaStatus",
          "contractRegions",
          "areaMatch",
        ].sort()
      );
    }
  });

  it("resourceCategory=ASSISTIVE_DEVICE_CENTER returns only the resource center", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { resourceCategory: "ASSISTIVE_DEVICE_CENTER" });
    expect(result.items.map((i) => i.id)).toEqual(["PROV-004"]);
    expect(result.items[0].services).toEqual([]);
  });

  it("resourceCategory=ASSISTIVE_DEVICE_CENTER + serviceType together is VALIDATION_ERROR", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(
      lookupProviders(repo, { resourceCategory: "ASSISTIVE_DEVICE_CENTER", serviceType: "ASSISTIVE_DEVICE" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("city must be 臺北市 or 新北市", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { city: "桃園市" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("district without city is VALIDATION_ERROR", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { district: "三重區" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("district not belonging to city is VALIDATION_ERROR", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { city: "臺北市", district: "三重區" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("areaFilter defaults to LOCATED_IN when city is given", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { city: "新北市", district: "三重區" });
    expect(result.appliedFilters.areaFilter).toBe("LOCATED_IN");
  });

  it("LOCATED_IN includes an UNCONFIRMED provider located there, with areaMatch=null", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { city: "新北市", district: "三重區", areaFilter: "LOCATED_IN" });
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain("PROV-002"); // UNCONFIRMED but located in 三重區
    const item002 = result.items.find((i) => i.id === "PROV-002")!;
    expect(item002.serviceAreaStatus).toBe("UNCONFIRMED");
    expect(item002.areaMatch).toBeNull();
  });

  it("SERVICE_AREA: only VERIFIED-covering providers by default; unconfirmedCount reflects hidden matches", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, {
      city: "新北市",
      district: "三重區",
      areaFilter: "SERVICE_AREA",
      serviceType: "ASSISTIVE_DEVICE",
    });
    // PROV-002 (UNCONFIRMED) must not appear; PROV-005 (VERIFIED, covers 三重區) must appear.
    expect(result.items.map((i) => i.id)).toEqual(["PROV-005"]);
    expect(result.items[0].areaMatch).toBe("VERIFIED");
    expect(result.unconfirmedCount).toBe(1);
  });

  it("SERVICE_AREA + includeUnconfirmed=true appends UNCONFIRMED after VERIFIED, marked areaMatch=UNCONFIRMED", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, {
      city: "新北市",
      district: "三重區",
      areaFilter: "SERVICE_AREA",
      serviceType: "ASSISTIVE_DEVICE",
      includeUnconfirmed: "true",
    });
    expect(result.items.map((i) => i.id)).toEqual(["PROV-005", "PROV-002"]);
    expect(result.items[1].areaMatch).toBe("UNCONFIRMED");
  });

  it("includeUnconfirmed=true without areaFilter=SERVICE_AREA is VALIDATION_ERROR", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(
      lookupProviders(repo, { city: "新北市", areaFilter: "LOCATED_IN", includeUnconfirmed: "true" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("contractCity filter matches providers listed in that city's contract regions (and serviceType, if given)", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { contractCity: "臺北市" });
    expect(result.items.map((i) => i.id)).toEqual(["PROV-005"]);
  });

  it("contractCity must be 臺北市 or 新北市", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { contractCity: "桃園市" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("q filters by name substring, 1-50 chars after trim", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { q: "輔具" });
    expect(result.items.map((i) => i.id).sort()).toEqual(["PROV-002", "PROV-004", "PROV-005"]);
    await expect(lookupProviders(repo, { q: "" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(lookupProviders(repo, { q: "x".repeat(51) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("page/pageSize: out-of-range page returns empty items with correct totalCount", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { page: "2", pageSize: "20" });
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(5);
    expect(result.page).toBe(2);
  });

  it("pageSize must be 1-50", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { pageSize: "100" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(lookupProviders(repo, { pageSize: "0" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("page must be >= 1", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { page: "0" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("unknown parameter is VALIDATION_ERROR", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(lookupProviders(repo, { sort: "distance" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("empty results still return success with an empty-state notice (no banned words)", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    const result = await lookupProviders(repo, { city: "新北市", district: "蘆洲區", serviceType: "HOME_MEDICAL_NURSING" });
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.notice).toContain("沒有符合條件");
  });

  it("notice never contains banned words (最近／附近／適合您／一定可)", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    for (const query of [{}, { city: "新北市" }, { city: "新北市", areaFilter: "SERVICE_AREA" }, { contractCity: "臺北市" }]) {
      const result = await lookupProviders(repo, query);
      for (const word of ["最近", "附近", "適合您", "一定可"]) {
        expect(result.notice).not.toContain(word);
      }
    }
  });
});

// B-005 推薦規則完全不變：不讀 contractRegions、不選資源中心（D-19 Q1／Q2）；同一機構可以出現在
// 查詢結果（UNCONFIRMED／LOCATED_IN）但永遠不會成為推薦候選。
describe("recommendation (B-005) is unaffected by resourceCategory/contractRegions (D-19)", () => {
  it("a provider findable via LOCATED_IN with UNCONFIRMED service area is never selected by findEligibleForRecommendation", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);

    const lookup = await lookupProviders(repo, { city: "新北市", district: "三重區", areaFilter: "LOCATED_IN" });
    expect(lookup.items.map((i) => i.id)).toContain("PROV-002");

    const eligible = await repo.findEligibleForRecommendation({ serviceType: "ASSISTIVE_DEVICE", city: "新北市", district: "三重區" });
    expect(eligible.map((p) => p.id)).not.toContain("PROV-002");
  });

  it("the resource center (ASSISTIVE_DEVICE_CENTER, no services) is never selected for any serviceType", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);

    for (const serviceType of ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"] as const) {
      const eligible = await repo.findEligibleForRecommendation({ serviceType, city: "新北市", district: "蘆洲區" });
      expect(eligible.map((p) => p.id)).not.toContain("PROV-004");
    }
  });

  it("a provider's contractRegions do not make it eligible for recommendation outside its verified service area", async () => {
    const repo = new InMemoryProviderRepository();
    await seed(repo);
    // PROV-005 is contracted in 臺北市 but its only verified service area is 新北市三重區.
    const eligible = await repo.findEligibleForRecommendation({ serviceType: "ASSISTIVE_DEVICE", city: "臺北市", district: null });
    expect(eligible.map((p) => p.id)).not.toContain("PROV-005");
  });
});
