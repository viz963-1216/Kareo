import type { AssessmentLocation } from "../types/api";

// C-005: builds the assessment `location` object (API_CONTRACT v0.2.2 §8).
// MVP service area is 臺北市／新北市 (PRODUCT_SPEC §7); every other user picks "其他縣市／不提供" and is
// sent as NONE (D-14b). The district list is administrative geography, not policy data.

export const SERVICE_CITIES = ["臺北市", "新北市"] as const;
export type ServiceCity = (typeof SERVICE_CITIES)[number];

export const DISTRICTS: Record<ServiceCity, readonly string[]> = {
  臺北市: ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"],
  新北市: [
    "板橋區", "三重區", "中和區", "永和區", "新莊區", "新店區", "樹林區", "鶯歌區", "三峽區", "淡水區",
    "汐止區", "瑞芳區", "土城區", "蘆洲區", "五股區", "泰山區", "林口區", "深坑區", "石碇區", "坪林區",
    "三芝區", "石門區", "八里區", "平溪區", "雙溪區", "貢寮區", "金山區", "萬里區", "烏來區",
  ],
};

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationInput {
  /** "" = 其他縣市／不提供 */
  city: string;
  /** "" = 只提供縣市 */
  district: string;
  /** Present only after the user chose「使用目前位置」and the browser returned a position. */
  coords: Coordinates | null;
}

export type LocationResult =
  | { ok: true; location: AssessmentLocation }
  | { ok: false; field: "city" | "district"; message: string };

export function isServiceCity(value: string): value is ServiceCity {
  return (SERVICE_CITIES as readonly string[]).includes(value);
}

const validCoords = (coords: Coordinates) =>
  Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
  && coords.lat >= -90 && coords.lat <= 90 && coords.lng >= -180 && coords.lng <= 180;

export function buildLocation({ city, district, coords }: LocationInput): LocationResult {
  if (city === "") {
    // No city: nothing else is sent, including any coordinates the browser returned.
    return { ok: true, location: { precision: "NONE", city: null, district: null, lat: null, lng: null } };
  }
  if (!isServiceCity(city)) return { ok: false, field: "city", message: "請從清單選擇縣市，或選擇「其他縣市／不提供位置」。" };
  if (district === "") {
    if (coords) {
      return { ok: false, field: "district", message: "使用目前位置時仍需選擇行政區（用來比對服務範圍）；或改為「不使用目前位置」。" };
    }
    return { ok: true, location: { precision: "CITY", city, district: null, lat: null, lng: null } };
  }
  if (!DISTRICTS[city].includes(district)) return { ok: false, field: "district", message: "請從清單選擇行政區。" };
  if (coords && validCoords(coords)) {
    return { ok: true, location: { precision: "GPS", city, district, lat: coords.lat, lng: coords.lng } };
  }
  return { ok: true, location: { precision: "DISTRICT", city, district, lat: null, lng: null } };
}
