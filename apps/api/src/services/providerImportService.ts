import type { ProviderRepository } from "../repositories/types.js";
import type {
  Provider,
  ProviderImportDataset,
  ProviderImportMode,
  ProviderImportReport,
  ProviderService,
  ProviderServiceArea,
  ProviderStatus,
  ProviderType,
  RawProviderRecord,
  RawProviderServiceAreaRecord,
  RawProviderServiceRecord,
} from "../types/index.js";
import { nowTaipeiISOString } from "../lib/response.js";

const PROVIDER_TYPES: ProviderType[] = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE", "OTHER"];
const PROVIDER_STATUSES: ProviderStatus[] = ["ACTIVE", "INACTIVE", "UNKNOWN"];
const PROVIDER_SERVICE_TYPES = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isNullableString(value: unknown): value is string | null {
  return value === null || value === undefined || typeof value === "string";
}
function isNullableNumber(value: unknown): value is number | null {
  return value === null || value === undefined || typeof value === "number";
}
function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  reasons: string[];
}

// 依 tasks/TASK-B-004.md + docs/DATA_MODEL.md 第 17 節。不合法的欄位一律拒收，不猜值。
function validateProvider(record: RawProviderRecord): ValidationResult<Provider> {
  const reasons: string[] = [];

  if (!isNonEmptyString(record.id)) reasons.push("缺少有效的 id");
  if (!isNonEmptyString(record.name)) reasons.push("缺少有效的 name");
  if (!isOneOf(record.type, PROVIDER_TYPES)) reasons.push("type 不合法");
  if (!isNonEmptyString(record.address)) reasons.push("缺少有效的 address");
  if (!isNonEmptyString(record.city)) reasons.push("缺少有效的 city");
  if (!isNonEmptyString(record.district)) reasons.push("缺少有效的 district");
  if (!isNullableNumber(record.lat)) reasons.push("lat 格式不合法");
  if (!isNullableNumber(record.lng)) reasons.push("lng 格式不合法");
  if (!isNullableString(record.phone)) reasons.push("phone 格式不合法");
  if (!isNullableString(record.website)) reasons.push("website 格式不合法");
  if (!isNullableString(record.googleMapsUrl)) reasons.push("googleMapsUrl 格式不合法");
  if (!isOneOf(record.status, PROVIDER_STATUSES)) reasons.push("status 不合法");
  if (typeof record.verified !== "boolean") reasons.push("verified 必須是 boolean");

  if (reasons.length > 0) return { ok: false, reasons };

  const now = nowTaipeiISOString();
  return {
    ok: true,
    reasons: [],
    value: {
      id: record.id as string,
      name: record.name as string,
      type: record.type as ProviderType,
      address: record.address as string,
      city: record.city as string,
      district: record.district as string,
      lat: (record.lat as number | null) ?? null,
      lng: (record.lng as number | null) ?? null,
      phone: (record.phone as string | null) ?? null,
      website: (record.website as string | null) ?? null,
      googleMapsUrl: (record.googleMapsUrl as string | null) ?? null,
      status: record.status as ProviderStatus,
      verified: record.verified as boolean,
      createdAt: now,
      updatedAt: now,
    },
  };
}

// 依 docs/DATA_MODEL.md 第 18 節。id / active 目前 A 的來源資料常缺漏（已知案例），
// 依 tasks/TASK-B-004.md 明確要求：不得自行生成 id 或預設 active，缺欄位一律拒收並回報，
// 待 A 修正來源資料後才能重新匯入。
function validateProviderService(
  record: RawProviderServiceRecord,
  acceptedProviderIds: ReadonlySet<string>
): ValidationResult<ProviderService> {
  const reasons: string[] = [];

  if (!isNonEmptyString(record.id)) reasons.push("缺少有效的 id（來源未提供，需由 A 補齊，不得由 B 自行生成）");
  if (!isNonEmptyString(record.providerId)) reasons.push("缺少有效的 providerId");
  else if (!acceptedProviderIds.has(record.providerId)) reasons.push("providerId 不存在於已驗證通過的 Provider 清單");
  if (!isOneOf(record.serviceType, PROVIDER_SERVICE_TYPES)) reasons.push("serviceType 不合法");
  if (typeof record.active !== "boolean")
    reasons.push("缺少有效的 active（來源未提供，需由 A 補齊，不得由 B 自行預設）");

  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    reasons: [],
    value: {
      id: record.id as string,
      providerId: record.providerId as string,
      serviceType: record.serviceType as ProviderService["serviceType"],
      active: record.active as boolean,
    },
  };
}

function validateProviderServiceArea(
  record: RawProviderServiceAreaRecord,
  acceptedProviderIds: ReadonlySet<string>
): ValidationResult<ProviderServiceArea> {
  const reasons: string[] = [];

  if (!isNonEmptyString(record.id)) reasons.push("缺少有效的 id");
  if (!isNonEmptyString(record.providerId)) reasons.push("缺少有效的 providerId");
  else if (!acceptedProviderIds.has(record.providerId)) reasons.push("providerId 不存在於已驗證通過的 Provider 清單");
  if (!isNonEmptyString(record.city)) reasons.push("缺少有效的 city");
  if (!isNonEmptyString(record.district)) reasons.push("缺少有效的 district");
  if (typeof record.active !== "boolean") reasons.push("active 必須是 boolean");

  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    reasons: [],
    value: {
      id: record.id as string,
      providerId: record.providerId as string,
      city: record.city as string,
      district: record.district as string,
      active: record.active as boolean,
    },
  };
}

export function hasRejections(report: ProviderImportReport): boolean {
  return (
    report.providersRejected.length > 0 ||
    report.servicesRejected.length > 0 ||
    report.serviceAreasRejected.length > 0
  );
}

// 依 tasks/TASK-B-004.md：Import 可重複執行（upsert by id，不增生）；
// 驗證不合格的紀錄一律拒收並記錄理由，不猜值、不靜默略過。
// mode 必填，不提供預設值，避免呼叫端誤把試匯入當成正式匯入（或反之）。
export async function importProviderDataset(
  repo: ProviderRepository,
  dataset: ProviderImportDataset,
  options: { mode: ProviderImportMode }
): Promise<ProviderImportReport> {
  const report: ProviderImportReport = {
    mode: options.mode,
    written: false,
    writtenCounts: null,
    providersValid: 0,
    providersRejected: [],
    servicesValid: 0,
    servicesRejected: [],
    serviceAreasValid: 0,
    serviceAreasRejected: [],
  };

  const acceptedProviders: Provider[] = [];
  for (const record of dataset.providers) {
    const result = validateProvider(record);
    if (result.ok && result.value) {
      acceptedProviders.push(result.value);
    } else {
      report.providersRejected.push({ record, reasons: result.reasons });
    }
  }
  const acceptedProviderIds = new Set(acceptedProviders.map((p) => p.id));

  const acceptedServices: ProviderService[] = [];
  for (const record of dataset.providerServices) {
    const result = validateProviderService(record, acceptedProviderIds);
    if (result.ok && result.value) {
      acceptedServices.push(result.value);
    } else {
      report.servicesRejected.push({ record, reasons: result.reasons });
    }
  }

  const acceptedAreas: ProviderServiceArea[] = [];
  for (const record of dataset.providerServiceAreas) {
    const result = validateProviderServiceArea(record, acceptedProviderIds);
    if (result.ok && result.value) {
      acceptedAreas.push(result.value);
    } else {
      report.serviceAreasRejected.push({ record, reasons: result.reasons });
    }
  }

  report.providersValid = acceptedProviders.length;
  report.servicesValid = acceptedServices.length;
  report.serviceAreasValid = acceptedAreas.length;

  if (options.mode === "dry-run" || hasRejections(report)) {
    return report;
  }

  // 依 ARCHITECTURE §22：驗證全部在上方完成，寫入只呼叫一次、在單一交易內完成。
  // 寫入失敗時錯誤直接往上拋（交易已回滾），不回傳 report，呼叫端不會誤以為成功。
  report.writtenCounts = await repo.importDatasetAtomically({
    providers: acceptedProviders,
    services: acceptedServices,
    serviceAreas: acceptedAreas,
  });
  report.written = true;

  return report;
}
