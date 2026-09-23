import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("../src/repositories/supabaseClient.js", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import { SupabaseProviderRepository, IMPORT_PROVIDER_DATASET_RPC } from "../src/repositories/supabaseProviderRepository.js";
import { AppError } from "../src/errors/AppError.js";
import { errorResponse } from "../src/lib/response.js";
import type { ProviderDatasetWrite } from "../src/repositories/types.js";

const dataset: ProviderDatasetWrite = {
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
      createdAt: "2026-09-23T00:00:00+08:00",
      updatedAt: "2026-09-23T00:00:00+08:00",
    },
  ],
  services: [{ id: "PSV-001", providerId: "PROV-001", serviceType: "HOME_CARE", active: true }],
  serviceAreas: [{ id: "PSA-001", providerId: "PROV-001", city: "新北市", district: "三重區", active: true }],
};

describe("SupabaseProviderRepository.importDatasetAtomically (ARCHITECTURE §22)", () => {
  beforeEach(() => rpc.mockReset());

  it("makes exactly one rpc call to import_provider_dataset with a snake_case payload for all three tables", async () => {
    rpc.mockResolvedValue({ data: { providers: 1, provider_services: 1, provider_service_areas: 1 }, error: null });

    const counts = await new SupabaseProviderRepository().importDatasetAtomically(dataset);

    expect(IMPORT_PROVIDER_DATASET_RPC).toBe("import_provider_dataset");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("import_provider_dataset", {
      payload: {
        providers: [
          expect.objectContaining({ id: "PROV-001", google_maps_url: "https://maps.google.com/...", created_at: "2026-09-23T00:00:00+08:00" }),
        ],
        provider_services: [{ id: "PSV-001", provider_id: "PROV-001", service_type: "HOME_CARE", active: true }],
        provider_service_areas: [{ id: "PSA-001", provider_id: "PROV-001", city: "新北市", district: "三重區", active: true }],
      },
    });
    expect(counts).toEqual({ providers: 1, providerServices: 1, providerServiceAreas: 1 });
  });

  it("turns an rpc (SQL) error into a safe AppError; SQL details stay in cause and never reach the API response", async () => {
    const sqlError = {
      code: "23503",
      message: 'insert or update on table "provider_service_areas" violates foreign key constraint',
      details: 'Key (provider_id)=(PROV-X) is not present in table "providers".',
    };
    rpc.mockResolvedValue({ data: null, error: sqlError });

    const err = await new SupabaseProviderRepository().importDatasetAtomically(dataset).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).not.toMatch(/foreign key|provider_service_areas|23503/);
    expect(err.cause).toBe(sqlError);

    const body = errorResponse(err).body;
    expect(body).not.toMatch(/foreign key|provider_service_areas|23503|PROV-X/);
  });
});
