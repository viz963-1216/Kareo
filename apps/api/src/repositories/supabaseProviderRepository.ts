import { getSupabaseClient } from "./supabaseClient.js";
import type {
  ProviderDatasetWrite,
  ProviderDatasetWriteCounts,
  ProviderRepository,
  RecommendationCandidateQuery,
} from "./types.js";
import type { Provider, ProviderDetailResponse } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

export const IMPORT_PROVIDER_DATASET_RPC = "import_provider_dataset";

// 組成 0005_import_provider_dataset.sql 預期的 payload：key 與資料表欄位名稱一致。
export function toImportPayload(dataset: ProviderDatasetWrite) {
  return {
    providers: dataset.providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      city: p.city,
      district: p.district,
      lat: p.lat,
      lng: p.lng,
      phone: p.phone,
      website: p.website,
      google_maps_url: p.googleMapsUrl,
      status: p.status,
      verified: p.verified,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
    provider_services: dataset.services.map((s) => ({
      id: s.id,
      provider_id: s.providerId,
      service_type: s.serviceType,
      active: s.active,
    })),
    provider_service_areas: dataset.serviceAreas.map((a) => ({
      id: a.id,
      provider_id: a.providerId,
      city: a.city,
      district: a.district,
      active: a.active,
    })),
  };
}

export class SupabaseProviderRepository implements ProviderRepository {
  async findDetailById(providerId: string): Promise<ProviderDetailResponse | null> {
    const client = getSupabaseClient();

    const { data: provider, error: providerError } = await client
      .from("providers")
      .select("id, name, type, address, city, district, phone, website, google_maps_url, verified, status")
      .eq("id", providerId)
      .maybeSingle();

    if (providerError) {
      throw new AppError("INTERNAL_ERROR", "無法查詢 Provider，請稍後再試。");
    }
    if (!provider || provider.status !== "ACTIVE") {
      // 依 DATA_MODEL.md 第 17 節：只有 ACTIVE 可被推薦/查看。
      return null;
    }

    const { data: services, error: servicesError } = await client
      .from("provider_services")
      .select("service_type")
      .eq("provider_id", providerId)
      .eq("active", true);

    if (servicesError) {
      throw new AppError("INTERNAL_ERROR", "無法查詢 Provider 服務類別，請稍後再試。");
    }

    const { data: areas, error: areasError } = await client
      .from("provider_service_areas")
      .select("city, district")
      .eq("provider_id", providerId)
      .eq("active", true);

    if (areasError) {
      throw new AppError("INTERNAL_ERROR", "無法查詢 Provider 服務範圍，請稍後再試。");
    }

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      address: provider.address,
      city: provider.city,
      district: provider.district,
      phone: provider.phone,
      website: provider.website,
      googleMapsUrl: provider.google_maps_url,
      verified: provider.verified,
      services: (services ?? []).map((s) => s.service_type),
      serviceAreas: (areas ?? []).map((a) => ({ city: a.city, district: a.district })),
    };
  }

  // 依 ARCHITECTURE §22：一次 rpc，由 Postgres function 在單一交易內寫入三張表。
  async importDatasetAtomically(dataset: ProviderDatasetWrite): Promise<ProviderDatasetWriteCounts> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc(IMPORT_PROVIDER_DATASET_RPC, { payload: toImportPayload(dataset) });

    if (error) {
      // SQL 細節只放在 cause（給操作人員 log），不放進 message。
      throw new AppError("INTERNAL_ERROR", "無法匯入 Provider 資料，交易已回滾，沒有寫入任何資料。", {
        cause: error,
      });
    }

    const counts = data as { providers: number; provider_services: number; provider_service_areas: number };
    return {
      providers: counts.providers,
      providerServices: counts.provider_services,
      providerServiceAreas: counts.provider_service_areas,
    };
  }

  // TASK-B-005：比照 findDetailById 的作法，分次查詢再於 Service 邊界組合，不用複雜 join／新的
  // RPC（ARCHITECTURE §22 的原子寫入 RPC 只核准 Provider 匯入／知識發布撤回兩種用途）。
  async findEligibleForRecommendation(query: RecommendationCandidateQuery): Promise<Provider[]> {
    const client = getSupabaseClient();

    const { data: services, error: servicesError } = await client
      .from("provider_services")
      .select("provider_id")
      .eq("service_type", query.serviceType)
      .eq("active", true);
    if (servicesError) throw new AppError("INTERNAL_ERROR", "無法查詢服務類別，請稍後再試。", { cause: servicesError });

    let areaQuery = client.from("provider_service_areas").select("provider_id").eq("active", true).eq("city", query.city);
    if (query.district !== null) areaQuery = areaQuery.eq("district", query.district);
    const { data: areas, error: areasError } = await areaQuery;
    if (areasError) throw new AppError("INTERNAL_ERROR", "無法查詢服務範圍，請稍後再試。", { cause: areasError });

    const serviceProviderIds = new Set((services ?? []).map((s) => s.provider_id));
    const areaProviderIds = new Set((areas ?? []).map((a) => a.provider_id));
    const eligibleIds = [...serviceProviderIds].filter((id) => areaProviderIds.has(id));
    if (eligibleIds.length === 0) return [];

    const { data: providers, error: providersError } = await client
      .from("providers")
      .select("id, name, type, address, city, district, lat, lng, phone, website, google_maps_url, status, verified, created_at, updated_at")
      .in("id", eligibleIds)
      .eq("status", "ACTIVE");
    if (providersError) throw new AppError("INTERNAL_ERROR", "無法查詢 Provider，請稍後再試。", { cause: providersError });

    return (providers ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      city: p.city,
      district: p.district,
      lat: p.lat,
      lng: p.lng,
      phone: p.phone,
      website: p.website,
      googleMapsUrl: p.google_maps_url,
      status: p.status,
      verified: p.verified,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }
}
