import { DISTRICTS } from "../location/location.ts";
import type {
  RecommendationServiceType,
  ResourceAreaFilter,
  ResourceCategory,
  ResourceLookupRequest,
} from "../types/api";

export type LookupCity = "" | "臺北市" | "新北市" | "OTHER";

export interface LookupForm {
  assistiveProgram: "" | "PURCHASE" | "SMART_TECH";
  resourceCategory: "" | ResourceCategory;
  serviceType: "" | RecommendationServiceType;
  city: LookupCity;
  district: string;
  areaFilter: "" | ResourceAreaFilter;
  includeUnconfirmed: boolean;
  q: string;
}

export const initialLookupForm: LookupForm = {
  assistiveProgram: "",
  resourceCategory: "",
  serviceType: "",
  city: "",
  district: "",
  areaFilter: "",
  includeUnconfirmed: false,
  q: "",
};

const isLookupServiceCity = (city: LookupCity): city is "臺北市" | "新北市" => city === "臺北市" || city === "新北市";

export function changeResourceCategory(form: LookupForm, resourceCategory: LookupForm["resourceCategory"]): LookupForm {
  return {
    ...form,
    resourceCategory,
    assistiveProgram: resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? "" : form.assistiveProgram,
    serviceType: resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? "" : form.serviceType,
    areaFilter: resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? (isLookupServiceCity(form.city) ? "LOCATED_IN" : "") : form.areaFilter,
    includeUnconfirmed: resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? false : form.includeUnconfirmed,
  };
}

export function changeLookupCity(form: LookupForm, city: LookupCity): LookupForm {
  const supported = isLookupServiceCity(city);
  return {
    ...form,
    city,
    district: "",
    areaFilter: supported ? form.areaFilter || "LOCATED_IN" : "",
    includeUnconfirmed: supported && form.areaFilter === "SERVICE_AREA" ? form.includeUnconfirmed : false,
  };
}

export function changeAreaFilter(form: LookupForm, areaFilter: LookupForm["areaFilter"]): LookupForm {
  if (form.resourceCategory === "ASSISTIVE_DEVICE_CENTER") return changeResourceCategory(form, form.resourceCategory);
  return {
    ...form,
    areaFilter,
    includeUnconfirmed: areaFilter === "SERVICE_AREA" ? form.includeUnconfirmed : false,
  };
}

export function withIncludeUnconfirmed(form: LookupForm, includeUnconfirmed: boolean): LookupForm {
  if (form.resourceCategory === "ASSISTIVE_DEVICE_CENTER") return changeResourceCategory(form, form.resourceCategory);
  return { ...form, areaFilter: "SERVICE_AREA", includeUnconfirmed };
}

export function previousLookupPage(page: number): number {
  return Math.max(1, page - 1);
}

export function buildResourceLookupRequest(form: LookupForm, page = 1): ResourceLookupRequest | null {
  if (form.city === "OTHER") return null;
  const q = form.q.trim();
  return {
    ...(form.assistiveProgram ? { assistiveProgram: form.assistiveProgram } : {}),
    ...(form.resourceCategory ? { resourceCategory: form.resourceCategory } : {}),
    ...(form.serviceType ? { serviceType: form.serviceType } : {}),
    ...(isLookupServiceCity(form.city) ? { city: form.city } : {}),
    ...(form.district ? { district: form.district } : {}),
    ...(form.areaFilter ? { areaFilter: form.areaFilter } : {}),
    ...(form.areaFilter === "SERVICE_AREA" && form.includeUnconfirmed ? { includeUnconfirmed: true } : {}),
    ...(q ? { q } : {}),
    page,
    pageSize: 20,
  };
}

/** Public links carry only resource filters, never assessment answers or coordinates. */
export function lookupFormFromParams(params: URLSearchParams): LookupForm {
  let form = { ...initialLookupForm };
  const city = params.get("city");
  if (city === "OTHER") form = changeLookupCity(form, city);
  if (city === "臺北市" || city === "新北市") {
    form = changeLookupCity(form, city);
    const district = params.get("district");
    if (district && DISTRICTS[city].includes(district)) form.district = district;
    const areaFilter = params.get("areaFilter");
    if (areaFilter === "LOCATED_IN" || areaFilter === "SERVICE_AREA") form = changeAreaFilter(form, areaFilter);
  }
  const serviceType = params.get("serviceType");
  if (serviceType === "HOME_CARE" || serviceType === "HOME_MEDICAL_NURSING" || serviceType === "ASSISTIVE_DEVICE") form.serviceType = serviceType;
  const category = params.get("resourceCategory");
  if (category === "SERVICE_PROVIDER" || category === "ASSISTIVE_DEVICE_CENTER") form = changeResourceCategory(form, category);
  const program = params.get("assistiveProgram");
  if ((program === "PURCHASE" || program === "SMART_TECH") && form.resourceCategory !== "ASSISTIVE_DEVICE_CENTER" && (!form.serviceType || form.serviceType === "ASSISTIVE_DEVICE")) form.assistiveProgram = program;
  form.q = (params.get("q") ?? "").trim().slice(0, 50);
  if (form.areaFilter === "SERVICE_AREA") form.includeUnconfirmed = params.get("includeUnconfirmed") === "true";
  return form;
}

export function lookupPageFromParams(params: URLSearchParams): number {
  const raw = params.get("page");
  const page = raw && /^\d+$/.test(raw) ? Number(raw) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Whitelist public filters; dropped controls and unknown query keys cannot become hidden constraints. */
export function lookupParams(form: LookupForm, page = 1): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["resourceCategory", "serviceType", "assistiveProgram", "city", "district", "areaFilter", "q"] as const) {
    const value = key === "q" ? form.q.trim() : form[key];
    if (value) params.set(key, value);
  }
  if (form.areaFilter === "SERVICE_AREA" && form.includeUnconfirmed) params.set("includeUnconfirmed", "true");
  if (Number.isSafeInteger(page) && page > 1) params.set("page", String(page));
  return params;
}
