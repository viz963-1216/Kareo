import { isProviderPublicInfo } from "../services/providerPublicInfo.js";
import { readPublicCatalogPages } from "./publicCatalogPagination.js";
import { getSupabaseClient } from "./supabaseClient.js";
import type {
  ProviderDatasetWrite,
  ProviderDatasetWriteCounts,
  ProviderLookupCandidate,
  ProviderRepository,
  RecommendationCandidateQuery,
} from "./types.js";
import type { Provider, ProviderDetailResponse, ProviderServiceType } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

function publicMetadata(value: unknown) {
  if (value === null || value === undefined) return {};
  if (!isProviderPublicInfo(value)) throw new AppError("INTERNAL_ERROR", "公開資源資料格式不完整，請稍後再試。");
  return { publicInfo: value };
}

export const IMPORT_PROVIDER_DATASET_RPC = "import_provider_dataset";

// 組成 0005_import_provider_dataset.sql 預期的 payload：key 與資料表欄位名稱一致。
export function toImportPayload(dataset: ProviderDatasetWrite) {
  return {
    providers: dataset.providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      resource_category: p.resourceCategory,
      ...(p.publicInfo ? { public_info: p.publicInfo } : {}),
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
    provider_contract_regions: dataset.contractRegions.map((c) => ({
      id: c.id,
      provider_id: c.providerId,
      city: c.city,
      service_type: c.serviceType,
      source_id: c.sourceId,
      checked_at: c.checkedAt,
      active: c.active,
    })),
  };
}

export class SupabaseProviderRepository implements ProviderRepository {
  async findDetailById(providerId: string): Promise<ProviderDetailResponse | null> {
    const client = getSupabaseClient();

    const { data: provider, error: providerError } = await client
      .from("providers")
      .select("id, name, type, resource_category, public_info, address, city, district, phone, website, google_maps_url, verified, status")
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

    const { data: contractRegions, error: contractRegionsError } = await client
      .from("provider_contract_regions")
      .select("city, service_type")
      .eq("provider_id", providerId)
      .eq("active", true);

    if (contractRegionsError) {
      throw new AppError("INTERNAL_ERROR", "無法查詢 Provider 特約縣市，請稍後再試。");
    }

    return {
      ...publicMetadata(provider.public_info),
      id: provider.id,
      name: provider.name,
      type: provider.type,
      resourceCategory: provider.resource_category,
      address: provider.address,
      city: provider.city,
      district: provider.district,
      phone: provider.phone,
      website: provider.website,
      googleMapsUrl: provider.google_maps_url,
      verified: provider.verified,
      services: (services ?? []).map((s) => s.service_type),
      serviceAreas: (areas ?? []).map((a) => ({ city: a.city, district: a.district })),
      serviceAreaStatus: (areas ?? []).length > 0 ? "VERIFIED" : "UNCONFIRMED",
      contractRegions: (contractRegions ?? []).map((c) => ({ city: c.city, serviceType: c.service_type })),
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

    const counts = data as {
      providers: number;
      provider_services: number;
      provider_service_areas: number;
      provider_contract_regions: number;
    };
    return {
      providers: counts.providers,
      providerServices: counts.provider_services,
      providerServiceAreas: counts.provider_service_areas,
      providerContractRegions: counts.provider_contract_regions,
    };
  }

  // TASK-B-005：比照 findDetailById 的作法，分次查詢再於 Service 邊界組合，不用複雜 join／新的
  // RPC（ARCHITECTURE §22 的原子寫入 RPC 只核准 Provider 匯入／知識發布撤回兩種用途）。
  async findEligibleForRecommendation(query: RecommendationCandidateQuery): Promise<Provider[]> {
    const client = getSupabaseClient();

    const services = await readPublicCatalogPages((start, end) => client.from("provider_services").select("provider_id").eq("service_type", query.serviceType).eq("active", true).order("id").range(start, end), "無法查詢服務類別，請稍後再試。");
    const areas = await readPublicCatalogPages((start, end) => {
      let request = client.from("provider_service_areas").select("provider_id").eq("active", true).eq("city", query.city);
      if (query.district !== null) request = request.eq("district", query.district);
      return request.order("id").range(start, end);
    }, "無法查詢服務範圍，請稍後再試。");

    const serviceProviderIds = new Set((services ?? []).map((s) => s.provider_id));
    const areaProviderIds = new Set((areas ?? []).map((a) => a.provider_id));
    const eligibleIds = [...serviceProviderIds].filter((id) => areaProviderIds.has(id));
    if (eligibleIds.length === 0) return [];

    const providers = await readPublicCatalogPages((start, end) => client.from("providers")
      .select("id, name, type, resource_category, public_info, address, city, district, lat, lng, phone, website, google_maps_url, status, verified, created_at, updated_at")
      .in("id", eligibleIds).eq("status", "ACTIVE").order("id").range(start, end), "無法查詢 Provider，請稍後再試。");

    return (providers ?? []).map((p) => ({
      ...publicMetadata(p.public_info),
      id: p.id,
      name: p.name,
      type: p.type,
      resourceCategory: p.resource_category,
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

  // TASK-B-013：比照既有作法（findDetailById／findEligibleForRecommendation），分次查詢再於
  // Service 邊界組合，不用 join 或新的 RPC（§10a Allowed Paths 指示「查詢只讀」）。MVP 資料量小，
  // 全量取出 ACTIVE Provider 後交給 Service 層套用篩選、排序（依 service-districts.json 順序，
  // 不是 DB 能直接排序的欄位）與分頁。
  async findActiveProvidersForLookup(): Promise<ProviderLookupCandidate[]> {
    const client = getSupabaseClient();

    const providers = await readPublicCatalogPages((start, end) => client
      .from("providers")
      .select("id, name, type, resource_category, public_info, address, city, district, lat, lng, phone, website, google_maps_url, status, verified, created_at, updated_at")
      .eq("status", "ACTIVE").order("id").range(start, end), "無法查詢 Provider，請稍後再試。");
    if (providers.length === 0) return [];
    const [services, areas, contractRegions] = await Promise.all([
      readPublicCatalogPages((start, end) => client.from("provider_services").select("provider_id, service_type").eq("active", true).order("id").range(start, end), "無法查詢服務類別，請稍後再試。"),
      readPublicCatalogPages((start, end) => client.from("provider_service_areas").select("provider_id, city, district").eq("active", true).order("id").range(start, end), "無法查詢服務範圍，請稍後再試。"),
      readPublicCatalogPages((start, end) => client.from("provider_contract_regions").select("provider_id, city, service_type").eq("active", true).order("id").range(start, end), "無法查詢特約縣市，請稍後再試。"),
    ]);

    const servicesByProvider = new Map<string, ProviderServiceType[]>();
    for (const s of services ?? []) {
      const list = servicesByProvider.get(s.provider_id) ?? [];
      list.push(s.service_type);
      servicesByProvider.set(s.provider_id, list);
    }
    const areasByProvider = new Map<string, Array<{ city: string; district: string }>>();
    for (const a of areas ?? []) {
      const list = areasByProvider.get(a.provider_id) ?? [];
      list.push({ city: a.city, district: a.district });
      areasByProvider.set(a.provider_id, list);
    }
    const contractRegionsByProvider = new Map<string, Array<{ city: string; serviceType: ProviderServiceType }>>();
    for (const c of contractRegions ?? []) {
      const list = contractRegionsByProvider.get(c.provider_id) ?? [];
      list.push({ city: c.city, serviceType: c.service_type });
      contractRegionsByProvider.set(c.provider_id, list);
    }

    return providers.map((p) => ({
      provider: {
        ...publicMetadata(p.public_info),
        id: p.id,
        name: p.name,
        type: p.type,
        resourceCategory: p.resource_category,
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
      },
      services: servicesByProvider.get(p.id) ?? [],
      serviceAreas: areasByProvider.get(p.id) ?? [],
      contractRegions: contractRegionsByProvider.get(p.id) ?? [],
    }));
  }
}
