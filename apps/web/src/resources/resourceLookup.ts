import type {
  RecommendationServiceType,
  ResourceAreaFilter,
  ResourceCategory,
  ResourceLookupRequest,
} from "../types/api";

export type LookupCity = "" | "臺北市" | "新北市" | "OTHER";

export interface LookupForm {
  resourceCategory: "" | ResourceCategory;
  serviceType: "" | RecommendationServiceType;
  city: LookupCity;
  district: string;
  areaFilter: "" | ResourceAreaFilter;
  includeUnconfirmed: boolean;
  contractCity: "" | "臺北市" | "新北市";
  q: string;
}

export const initialLookupForm: LookupForm = {
  resourceCategory: "",
  serviceType: "",
  city: "",
  district: "",
  areaFilter: "",
  includeUnconfirmed: false,
  contractCity: "",
  q: "",
};

const isLookupServiceCity = (city: LookupCity): city is "臺北市" | "新北市" => city === "臺北市" || city === "新北市";

export function changeResourceCategory(form: LookupForm, resourceCategory: LookupForm["resourceCategory"]): LookupForm {
  return {
    ...form,
    resourceCategory,
    serviceType: resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? "" : form.serviceType,
  };
}

export function changeLookupCity(form: LookupForm, city: LookupCity): LookupForm {
  const supported = isLookupServiceCity(city);
  return {
    ...form,
    city,
    district: "",
    areaFilter: supported ? form.areaFilter : "",
    includeUnconfirmed: supported && form.areaFilter === "SERVICE_AREA" ? form.includeUnconfirmed : false,
  };
}

export function changeAreaFilter(form: LookupForm, areaFilter: LookupForm["areaFilter"]): LookupForm {
  return {
    ...form,
    areaFilter,
    includeUnconfirmed: areaFilter === "SERVICE_AREA" ? form.includeUnconfirmed : false,
  };
}

export function withIncludeUnconfirmed(form: LookupForm, includeUnconfirmed: boolean): LookupForm {
  return { ...form, areaFilter: "SERVICE_AREA", includeUnconfirmed };
}

export function previousLookupPage(page: number): number {
  return Math.max(1, page - 1);
}

export function buildResourceLookupRequest(form: LookupForm, page = 1): ResourceLookupRequest | null {
  if (form.city === "OTHER") return null;
  const q = form.q.trim();
  return {
    ...(form.resourceCategory ? { resourceCategory: form.resourceCategory } : {}),
    ...(form.serviceType ? { serviceType: form.serviceType } : {}),
    ...(isLookupServiceCity(form.city) ? { city: form.city } : {}),
    ...(form.district ? { district: form.district } : {}),
    ...(form.areaFilter ? { areaFilter: form.areaFilter } : {}),
    ...(form.areaFilter === "SERVICE_AREA" && form.includeUnconfirmed ? { includeUnconfirmed: true } : {}),
    ...(form.contractCity ? { contractCity: form.contractCity } : {}),
    ...(q ? { q } : {}),
    page,
    pageSize: 20,
  };
}

/** Public links carry only resource filters, never assessment answers or coordinates. */
export function lookupFormFromParams(params: URLSearchParams): LookupForm {
  let form = { ...initialLookupForm };
  const city = params.get("city");
  if (city === "臺北市" || city === "新北市") form = changeLookupCity(form, city);
  const serviceType = params.get("serviceType");
  if (serviceType === "HOME_CARE" || serviceType === "HOME_MEDICAL_NURSING" || serviceType === "ASSISTIVE_DEVICE") form.serviceType = serviceType;
  const category = params.get("resourceCategory");
  if (category === "SERVICE_PROVIDER" || category === "ASSISTIVE_DEVICE_CENTER") form = changeResourceCategory(form, category);
  return form;
}
