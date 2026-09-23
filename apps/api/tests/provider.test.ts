import { describe, it, expect } from "vitest";
import { getProviderDetail } from "../src/services/providerService.js";
import { InMemoryProviderRepository } from "../src/repositories/inMemoryRepositories.js";
import { AppError } from "../src/errors/AppError.js";

async function seedProvider(repo: InMemoryProviderRepository) {
  await repo.importDatasetAtomically({
    providers: [
    {
      id: "PROV-001",
      name: "測試居家照顧中心",
      type: "HOME_CARE",
      address: "新北市三重區重新路三段1號",
      city: "新北市",
      district: "三重區",
      lat: null,
      lng: null,
      phone: "02-00000001",
      website: null,
      googleMapsUrl: "https://maps.google.com/...",
      status: "ACTIVE",
      verified: true,
      createdAt: "2026-09-22T00:00:00+08:00",
      updatedAt: "2026-09-22T00:00:00+08:00",
    },
    ],
    services: [{ id: "PSV-001", providerId: "PROV-001", serviceType: "HOME_CARE", active: true }],
    serviceAreas: [{ id: "PSA-001", providerId: "PROV-001", city: "新北市", district: "三重區", active: true }],
  });
}

describe("Provider Detail (TASK-B-004)", () => {
  it("valid provider: returns response shape matching API_CONTRACT.md section 10", async () => {
    const repo = new InMemoryProviderRepository();
    await seedProvider(repo);

    const detail = await getProviderDetail(repo, "PROV-001");

    expect(detail).toEqual({
      id: "PROV-001",
      name: "測試居家照顧中心",
      type: "HOME_CARE",
      address: "新北市三重區重新路三段1號",
      city: "新北市",
      district: "三重區",
      phone: "02-00000001",
      website: null,
      googleMapsUrl: "https://maps.google.com/...",
      verified: true,
      services: ["HOME_CARE"],
      serviceAreas: [{ city: "新北市", district: "三重區" }],
    });
  });

  it("not found: unknown providerId rejects with NOT_FOUND", async () => {
    const repo = new InMemoryProviderRepository();
    await seedProvider(repo);

    await expect(getProviderDetail(repo, "PROV-DOES-NOT-EXIST")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("not found: INACTIVE provider is not returned (only ACTIVE can be viewed)", async () => {
    const repo = new InMemoryProviderRepository();
    await repo.importDatasetAtomically({
      services: [],
      serviceAreas: [],
      providers: [
      {
        id: "PROV-002",
        name: "已停業服務中心",
        type: "HOME_CARE",
        address: "測試地址",
        city: "新北市",
        district: "三重區",
        lat: null,
        lng: null,
        phone: null,
        website: null,
        googleMapsUrl: null,
        status: "INACTIVE",
        verified: false,
        createdAt: "2026-09-22T00:00:00+08:00",
        updatedAt: "2026-09-22T00:00:00+08:00",
      },
      ],
    });

    await expect(getProviderDetail(repo, "PROV-002")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("invalid: missing/empty providerId rejects with VALIDATION_ERROR", async () => {
    const repo = new InMemoryProviderRepository();
    await expect(getProviderDetail(repo, undefined)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getProviderDetail(repo, "")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("propagates AppError as-is (e.g. INTERNAL_ERROR from repository) for the function layer to convert safely", async () => {
    const failingRepo = new InMemoryProviderRepository();
    failingRepo.findDetailById = async () => {
      throw new AppError("INTERNAL_ERROR", "模擬資料庫錯誤");
    };

    await expect(getProviderDetail(failingRepo, "PROV-001")).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});
