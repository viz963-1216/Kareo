import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hasRejections, importProviderDataset } from "../src/services/providerImportService.js";
import { InMemoryProviderRepository } from "../src/repositories/inMemoryRepositories.js";
import type { ProviderImportDataset } from "../src/types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_DATASET_DIR = path.resolve(__dirname, "../../../data/providers/staging");

function readRealDataset(): ProviderImportDataset {
  const read = (name: string) => JSON.parse(readFileSync(path.join(REAL_DATASET_DIR, name), "utf-8"));
  return {
    providers: read("providers.json"),
    providerServices: read("provider-services.json"),
    providerServiceAreas: read("provider-service-areas.json"),
  };
}

const validProvider = {
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
};

function fullyValidDataset(): ProviderImportDataset {
  return {
    providers: [validProvider],
    providerServices: [{ id: "PSV-001", providerId: "PROV-001", serviceType: "HOME_CARE", active: true }],
    providerServiceAreas: [
      { id: "PSA-001", providerId: "PROV-001", city: "新北市", district: "三重區", active: true },
    ],
  };
}

describe("Provider Import (TASK-B-004)", () => {
  it("commit mode: a fully valid dataset is written", async () => {
    const repo = new InMemoryProviderRepository();

    const report = await importProviderDataset(repo, fullyValidDataset(), { mode: "commit" });

    expect(report.written).toBe(true);
    expect(hasRejections(report)).toBe(false);
    expect(report.providersValid).toBe(1);
    expect(report.servicesValid).toBe(1);
    expect(report.serviceAreasValid).toBe(1);
    expect(repo.providers).toHaveLength(1);
    expect(repo.services).toHaveLength(1);
    expect(repo.serviceAreas).toHaveLength(1);
  });

  it("commit mode: ANY rejection means nothing is written — not even the valid providers", async () => {
    const repo = new InMemoryProviderRepository();
    const dataset: ProviderImportDataset = {
      providers: [validProvider],
      providerServices: [{ providerId: "PROV-001", serviceType: "HOME_CARE" }], // 缺 id、active
      providerServiceAreas: [
        { id: "PSA-001", providerId: "PROV-001", city: "新北市", district: "三重區", active: true },
      ],
    };

    const report = await importProviderDataset(repo, dataset, { mode: "commit" });

    expect(report.written).toBe(false);
    expect(report.providersValid).toBe(1);
    expect(report.servicesRejected).toHaveLength(1);
    expect(repo.providers).toHaveLength(0);
    expect(repo.services).toHaveLength(0);
    expect(repo.serviceAreas).toHaveLength(0);
  });

  it("dry-run mode: never writes, even when the dataset is fully valid", async () => {
    const repo = new InMemoryProviderRepository();

    const report = await importProviderDataset(repo, fullyValidDataset(), { mode: "dry-run" });

    expect(report.mode).toBe("dry-run");
    expect(report.written).toBe(false);
    expect(report.providersValid).toBe(1);
    expect(repo.providers).toHaveLength(0);
    expect(repo.services).toHaveLength(0);
    expect(repo.serviceAreas).toHaveLength(0);
  });

  it("rejects (not guesses) provider_services records missing id/active — matches real A-002 staging dataset shape", async () => {
    // 對應真實 data/providers/staging/provider-services.json 現況：只有 providerId + serviceType，
    // 沒有 id / active。依 tasks/TASK-B-004.md，這種紀錄必須拒收並回報，不得由 B 自行生成或預設。
    const repo = new InMemoryProviderRepository();
    const dataset: ProviderImportDataset = {
      providers: [validProvider],
      providerServices: [{ providerId: "PROV-001", serviceType: "HOME_CARE" }],
      providerServiceAreas: [],
    };

    const report = await importProviderDataset(repo, dataset, { mode: "dry-run" });

    expect(report.servicesValid).toBe(0);
    expect(report.servicesRejected).toHaveLength(1);
    const reasons = report.servicesRejected[0].reasons.join(" | ");
    expect(reasons).toMatch(/id/);
    expect(reasons).toMatch(/active/);
  });

  it("rejects a provider record with an invalid type enum", async () => {
    const repo = new InMemoryProviderRepository();
    const dataset: ProviderImportDataset = {
      providers: [{ ...validProvider, type: "NOT_A_REAL_TYPE" }],
      providerServices: [],
      providerServiceAreas: [],
    };

    const report = await importProviderDataset(repo, dataset, { mode: "dry-run" });
    expect(report.providersValid).toBe(0);
    expect(report.providersRejected).toHaveLength(1);
  });

  it("rejects a service/area whose providerId does not exist among valid providers", async () => {
    const repo = new InMemoryProviderRepository();
    const dataset: ProviderImportDataset = {
      providers: [],
      providerServices: [{ id: "PSV-001", providerId: "PROV-999", serviceType: "HOME_CARE", active: true }],
      providerServiceAreas: [
        { id: "PSA-001", providerId: "PROV-999", city: "新北市", district: "三重區", active: true },
      ],
    };

    const report = await importProviderDataset(repo, dataset, { mode: "dry-run" });
    expect(report.servicesRejected).toHaveLength(1);
    expect(report.servicesRejected[0].reasons.join(" ")).toMatch(/不存在於已驗證通過的 Provider 清單/);
    expect(report.serviceAreasRejected).toHaveLength(1);
  });

  it("commit mode is idempotent: running the same import twice does not duplicate records", async () => {
    const repo = new InMemoryProviderRepository();

    await importProviderDataset(repo, fullyValidDataset(), { mode: "commit" });
    await importProviderDataset(repo, fullyValidDataset(), { mode: "commit" });

    expect(repo.providers).toHaveLength(1);
    expect(repo.services).toHaveLength(1);
    expect(repo.serviceAreas).toHaveLength(1);
  });

  it("real A-002 staging dataset in commit mode: 30 services rejected for missing id/active, so NOTHING is written", async () => {
    const repo = new InMemoryProviderRepository();
    const dataset = readRealDataset();

    const report = await importProviderDataset(repo, dataset, { mode: "commit" });

    expect(dataset.providers.length).toBe(30);
    expect(report.providersValid).toBe(30);
    expect(report.providersRejected).toHaveLength(0);

    expect(dataset.providerServices.length).toBe(30);
    expect(report.servicesValid).toBe(0);
    expect(report.servicesRejected).toHaveLength(30);
    for (const rejected of report.servicesRejected) {
      expect(rejected.reasons.join(" ")).toMatch(/id/);
      expect(rejected.reasons.join(" ")).toMatch(/active/);
    }

    expect(report.serviceAreasRejected).toHaveLength(0);
    expect(report.serviceAreasValid).toBe(dataset.providerServiceAreas.length);

    expect(report.written).toBe(false);
    expect(repo.providers).toHaveLength(0);
    expect(repo.services).toHaveLength(0);
    expect(repo.serviceAreas).toHaveLength(0);
  });
});
