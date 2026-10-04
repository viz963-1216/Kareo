// TASK-B-013：GET /api/v1/providers，依 docs/API_CONTRACT.md §10a（v0.6，D-18、D-19）。
// 公開端點，不需要 session；只讀查詢，不建立或讀取 Assessment／RecommendationRun／Lead
// （PRIVACY_AND_RETENTION §2：查詢條件不得寫入 log）。
//
// 靜態 JSON import（同 consentVersionService.ts）：esbuild 會把 JSON 打進 Netlify 的 ESM 與
// CommonJS 兩種輸出；createRequire(import.meta.url) 在 CommonJS 打包時 import.meta 為 undefined
// 而失敗，ESM 打包後相對路徑的 JSON 也不會被帶上。
import serviceDistricts from "../../../../contracts/reference/service-districts.json" with { type: "json" };
import type { ProviderRepository } from "../repositories/types.js";
import type {
  AreaFilter,
  ProviderLookupAppliedFilters,
  ProviderLookupItem,
  ProviderLookupResponse,
  ProviderResourceCategory,
  ProviderServiceType,
  ServiceAreaStatus,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";

const CITY_ORDER = serviceDistricts.cities.map((c) => c.city);
const DISTRICTS_BY_CITY = new Map(serviceDistricts.cities.map((c) => [c.city, c.districts]));

const RESOURCE_CATEGORIES: ProviderResourceCategory[] = ["SERVICE_PROVIDER", "ASSISTIVE_DEVICE_CENTER"];
const SERVICE_TYPES: ProviderServiceType[] = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"];
const AREA_FILTERS: AreaFilter[] = ["LOCATED_IN", "SERVICE_AREA"];
const KNOWN_PARAMS = new Set([
  "resourceCategory",
  "serviceType",
  "city",
  "district",
  "areaFilter",
  "includeUnconfirmed",
  "contractCity",
  "q",
  "page",
  "pageSize",
]);

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

interface ParsedQuery {
  resourceCategory: ProviderResourceCategory | null;
  serviceType: ProviderServiceType | null;
  city: string | null;
  district: string | null;
  areaFilter: AreaFilter | null;
  includeUnconfirmed: boolean;
  contractCity: string | null;
  q: string | null;
  page: number;
  pageSize: number;
}

// query 的每個值都是字串（Netlify queryStringParameters）或 undefined；不接受陣列或其他型態
// （代表同名參數出現多次，視為格式不合法）。
function parseQuery(query: Record<string, unknown> | null | undefined): ParsedQuery {
  const q = query ?? {};

  for (const key of Object.keys(q)) {
    if (!KNOWN_PARAMS.has(key)) {
      throw new AppError("VALIDATION_ERROR", "查詢條件包含不支援的欄位。");
    }
  }

  const raw = (key: string): string | undefined => {
    const v = q[key];
    return typeof v === "string" ? v : undefined;
  };

  const resourceCategoryRaw = raw("resourceCategory");
  if (resourceCategoryRaw !== undefined && !isOneOf(resourceCategoryRaw, RESOURCE_CATEGORIES)) {
    throw new AppError("VALIDATION_ERROR", "resourceCategory 不合法。");
  }
  const resourceCategory = (resourceCategoryRaw as ProviderResourceCategory | undefined) ?? null;

  const serviceTypeRaw = raw("serviceType");
  if (serviceTypeRaw !== undefined && !isOneOf(serviceTypeRaw, SERVICE_TYPES)) {
    throw new AppError("VALIDATION_ERROR", "serviceType 不合法。");
  }
  const serviceType = (serviceTypeRaw as ProviderServiceType | undefined) ?? null;

  if (resourceCategory === "ASSISTIVE_DEVICE_CENTER" && serviceType !== null) {
    throw new AppError("VALIDATION_ERROR", "輔具資源中心不適用服務類別篩選，請擇一使用。");
  }

  const cityRaw = raw("city");
  let city: string | null = null;
  if (cityRaw !== undefined) {
    if (!CITY_ORDER.includes(cityRaw)) {
      throw new AppError("VALIDATION_ERROR", "本階段只提供臺北市、新北市的資源查詢。");
    }
    city = cityRaw;
  }

  const districtRaw = raw("district");
  let district: string | null = null;
  if (districtRaw !== undefined) {
    if (city === null) {
      throw new AppError("VALIDATION_ERROR", "選擇行政區前請先選擇縣市。");
    }
    if (!DISTRICTS_BY_CITY.get(city)!.includes(districtRaw)) {
      throw new AppError("VALIDATION_ERROR", "行政區不屬於所選縣市，請重新選擇。");
    }
    district = districtRaw;
  }

  const areaFilterRaw = raw("areaFilter");
  let areaFilter: AreaFilter | null;
  if (areaFilterRaw !== undefined) {
    if (!isOneOf(areaFilterRaw, AREA_FILTERS) || city === null) {
      throw new AppError("VALIDATION_ERROR", "areaFilter 設定不合法，或尚未選擇縣市。");
    }
    areaFilter = areaFilterRaw;
  } else {
    areaFilter = city !== null ? "LOCATED_IN" : null;
  }

  const includeUnconfirmedRaw = raw("includeUnconfirmed");
  let includeUnconfirmed = false;
  if (includeUnconfirmedRaw !== undefined) {
    if (includeUnconfirmedRaw !== "true" && includeUnconfirmedRaw !== "false") {
      throw new AppError("VALIDATION_ERROR", "includeUnconfirmed 格式不合法。");
    }
    includeUnconfirmed = includeUnconfirmedRaw === "true";
  }
  if (includeUnconfirmed && areaFilter !== "SERVICE_AREA") {
    throw new AppError("VALIDATION_ERROR", "只有依服務範圍篩選時，才能選擇顯示服務範圍待確認的機構。");
  }

  const contractCityRaw = raw("contractCity");
  let contractCity: string | null = null;
  if (contractCityRaw !== undefined) {
    if (!CITY_ORDER.includes(contractCityRaw)) {
      throw new AppError("VALIDATION_ERROR", "本階段只提供臺北市、新北市的特約名單查詢。");
    }
    contractCity = contractCityRaw;
  }

  const qRaw = raw("q");
  let keyword: string | null = null;
  if (qRaw !== undefined) {
    const trimmed = qRaw.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      throw new AppError("VALIDATION_ERROR", "q 長度需介於 1 到 50 字。");
    }
    keyword = trimmed;
  }

  const pageRaw = raw("page");
  let page = 1;
  if (pageRaw !== undefined) {
    const n = Number(pageRaw);
    if (!Number.isInteger(n) || n < 1) {
      throw new AppError("VALIDATION_ERROR", "page 必須是大於等於 1 的整數。");
    }
    page = n;
  }

  const pageSizeRaw = raw("pageSize");
  let pageSize = 20;
  if (pageSizeRaw !== undefined) {
    const n = Number(pageSizeRaw);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      throw new AppError("VALIDATION_ERROR", "每頁筆數需介於 1 到 50。");
    }
    pageSize = n;
  }

  return { resourceCategory, serviceType, city, district, areaFilter, includeUnconfirmed, contractCity, q: keyword, page, pageSize };
}

function sortKey(city: string, district: string, id: string): [number, number, string] {
  return [CITY_ORDER.indexOf(city), DISTRICTS_BY_CITY.get(city)?.indexOf(district) ?? -1, id];
}

function compareSortKey(a: [number, number, string], b: [number, number, string]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
}

function buildNotice(filters: ParsedQuery, resultCount: number, unconfirmedCount: number | null): string {
  if (resultCount === 0) {
    return "目前沒有符合條件的資源。可調整篩選條件，或聯絡 1966 長照專線洽詢。";
  }
  if (filters.contractCity !== null) {
    return "以下為列於所選縣市特約名單的機構。特約名單只表示該機構與縣市政府簽約，不代表能到府服務或服務您所在的行政區；本結果不是依您的個案狀況所做的推薦。";
  }
  if (filters.areaFilter === "SERVICE_AREA") {
    if (filters.includeUnconfirmed) {
      return "以下包含服務範圍待確認的機構（列在最後）。標示「服務範圍待確認」者，目前沒有資料確認能服務您所選地區，請先洽機構確認。本結果不是依您的個案狀況所做的推薦，也不代表距離遠近。";
    }
    const extra =
      unconfirmedCount && unconfirmedCount > 0 ? `另有 ${unconfirmedCount} 家機構的服務範圍待確認，可選擇一併顯示。` : "";
    return `以下為已確認服務範圍包含您所選地區的機構，僅供查詢參考，不是依您的個案狀況所做的推薦，也不代表距離遠近。${extra}`;
  }
  if (filters.areaFilter === "LOCATED_IN") {
    return "以下為資訊查詢結果，依機構所在地篩選，不是依您的個案狀況所做的推薦，也不代表距離遠近或能到府服務。各機構實際服務範圍請見詳細資料，或洽機構確認。";
  }
  return "以下為資訊查詢結果，不是依您的個案狀況所做的推薦，也不代表距離遠近或能到府服務。各機構實際服務範圍請見詳細資料，或洽機構確認。";
}

export async function lookupProviders(
  repo: ProviderRepository,
  query: Record<string, unknown> | null | undefined
): Promise<ProviderLookupResponse> {
  const filters = parseQuery(query);
  const candidates = await repo.findActiveProvidersForLookup();

  type Scored = { item: ProviderLookupItem; key: [number, number, string] };
  const verified: Scored[] = [];
  const unconfirmed: Scored[] = [];
  let unconfirmedCount = 0;

  for (const candidate of candidates) {
    const { provider, services, serviceAreas, contractRegions } = candidate;

    if (filters.resourceCategory !== null && provider.resourceCategory !== filters.resourceCategory) continue;
    if (filters.serviceType !== null && !services.includes(filters.serviceType)) continue;
    if (filters.q !== null && !provider.name.includes(filters.q)) continue;
    if (
      filters.contractCity !== null &&
      !contractRegions.some((r) => r.city === filters.contractCity && (filters.serviceType === null || r.serviceType === filters.serviceType))
    ) {
      continue;
    }

    const serviceAreaStatus: ServiceAreaStatus = serviceAreas.length > 0 ? "VERIFIED" : "UNCONFIRMED";
    const publicContractRegions = contractRegions.map((r) => ({ city: r.city, serviceType: r.serviceType }));
    const baseItem: Omit<ProviderLookupItem, "areaMatch"> = {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      resourceCategory: provider.resourceCategory,
      services,
      address: provider.address,
      city: provider.city,
      district: provider.district,
      phone: provider.phone,
      website: provider.website,
      googleMapsUrl: provider.googleMapsUrl,
      verified: provider.verified,
      serviceAreaStatus,
      contractRegions: publicContractRegions,
    };
    const key = sortKey(provider.city, provider.district, provider.id);

    if (filters.areaFilter === "LOCATED_IN") {
      if (provider.city !== filters.city) continue;
      if (filters.district !== null && provider.district !== filters.district) continue;
      verified.push({ item: { ...baseItem, areaMatch: null }, key });
    } else if (filters.areaFilter === "SERVICE_AREA") {
      const covers = serviceAreas.some(
        (a) => a.city === filters.city && (filters.district === null || a.district === filters.district)
      );
      if (covers) {
        verified.push({ item: { ...baseItem, areaMatch: "VERIFIED" }, key });
      } else if (serviceAreaStatus === "UNCONFIRMED") {
        unconfirmedCount += 1;
        if (filters.includeUnconfirmed) {
          unconfirmed.push({ item: { ...baseItem, areaMatch: "UNCONFIRMED" }, key });
        }
      }
      // serviceAreaStatus === VERIFIED but 不覆蓋所選地區：不符合條件，略過，不計入 unconfirmedCount。
    } else {
      verified.push({ item: { ...baseItem, areaMatch: null }, key });
    }
  }

  verified.sort((a, b) => compareSortKey(a.key, b.key));
  unconfirmed.sort((a, b) => compareSortKey(a.key, b.key));
  const all = [...verified, ...unconfirmed].map((s) => s.item);

  const totalCount = all.length;
  const start = (filters.page - 1) * filters.pageSize;
  const items = all.slice(start, start + filters.pageSize);

  const appliedFilters: ProviderLookupAppliedFilters = {
    resourceCategory: filters.resourceCategory,
    serviceType: filters.serviceType,
    city: filters.city,
    district: filters.district,
    areaFilter: filters.areaFilter,
    includeUnconfirmed: filters.includeUnconfirmed,
    contractCity: filters.contractCity,
    q: filters.q,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  return {
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    totalCount,
    unconfirmedCount: filters.areaFilter === "SERVICE_AREA" ? unconfirmedCount : null,
    appliedFilters,
    notice: buildNotice(filters, totalCount, filters.areaFilter === "SERVICE_AREA" ? unconfirmedCount : null),
  };
}

// Cheap validation precedes persistent rate-limit/lookup I/O. No query values are logged.
export function validateLookupQuery(query: Record<string, unknown> | null | undefined): void {
  parseQuery(query);
}
