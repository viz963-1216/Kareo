import { getSupabaseClient } from "./supabaseClient.js";
import type { ProviderRepository } from "./types.js";
import type { Provider, ProviderDetailResponse, ProviderService, ProviderServiceArea } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

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

  async upsertProviders(providers: Provider[]): Promise<void> {
    if (providers.length === 0) return;
    const client = getSupabaseClient();
    const { error } = await client.from("providers").upsert(
      providers.map((p) => ({
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
      { onConflict: "id" }
    );
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法匯入 Provider 資料，請稍後再試。");
    }
  }

  async upsertProviderServices(services: ProviderService[]): Promise<void> {
    if (services.length === 0) return;
    const client = getSupabaseClient();
    const { error } = await client.from("provider_services").upsert(
      services.map((s) => ({
        id: s.id,
        provider_id: s.providerId,
        service_type: s.serviceType,
        active: s.active,
      })),
      { onConflict: "id" }
    );
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法匯入 Provider 服務類別，請稍後再試。");
    }
  }

  async upsertProviderServiceAreas(areas: ProviderServiceArea[]): Promise<void> {
    if (areas.length === 0) return;
    const client = getSupabaseClient();
    const { error } = await client.from("provider_service_areas").upsert(
      areas.map((a) => ({
        id: a.id,
        provider_id: a.providerId,
        city: a.city,
        district: a.district,
        active: a.active,
      })),
      { onConflict: "id" }
    );
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法匯入 Provider 服務範圍，請稍後再試。");
    }
  }
}
