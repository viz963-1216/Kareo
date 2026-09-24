import homeCareCityRotationFixture from "../../../../contracts/mock/recommendations/ranking-variants/HOME_CARE-CITY_ROTATION.json";
import homeCareDistanceMissingCoordinatesFixture from "../../../../contracts/mock/recommendations/ranking-variants/HOME_CARE-DISTANCE-MISSING-COORDINATES.json";
import homeCareDistanceFixture from "../../../../contracts/mock/recommendations/ranking-variants/HOME_CARE-DISTANCE.json";
import homeCareNoLocationFixture from "../../../../contracts/mock/recommendations/ranking-variants/HOME_CARE-NO_LOCATION.json";
import assistiveDeviceFixture from "../../../../contracts/mock/recommendations/ASSISTIVE_DEVICE.json";
import homeCareFixture from "../../../../contracts/mock/recommendations/HOME_CARE.json";
import homeMedicalNursingFixture from "../../../../contracts/mock/recommendations/HOME_MEDICAL_NURSING.json";
import type {
  LocationPrecision,
  RecommendationEnvelope,
  RecommendationResponse,
  RecommendationServiceType,
} from "../types/api";
import type { RecommendationMockCount, RecommendationMockRanking } from "./mockScenarios";

const districtFixtures: Record<RecommendationServiceType, RecommendationEnvelope> = {
  HOME_CARE: homeCareFixture as RecommendationEnvelope,
  HOME_MEDICAL_NURSING: homeMedicalNursingFixture as RecommendationEnvelope,
  ASSISTIVE_DEVICE: assistiveDeviceFixture as RecommendationEnvelope,
};

// Variant fixtures exist only for HOME_CARE (fixture gap reported to J-002 in the C-005 PR).
const homeCareVariants: Record<Exclude<RecommendationMockRanking, "district">, RecommendationEnvelope> = {
  distance: homeCareDistanceFixture as RecommendationEnvelope,
  "missing-coordinates": homeCareDistanceMissingCoordinatesFixture as RecommendationEnvelope,
  city: homeCareCityRotationFixture as RecommendationEnvelope,
  "no-location": homeCareNoLocationFixture as RecommendationEnvelope,
};

const scenarioNames: Record<RecommendationMockRanking, string> = {
  distance: "距離排序",
  "missing-coordinates": "精確位置但缺座標",
  district: "行政區輪替",
  city: "縣市輪替",
  "no-location": "沒有位置",
};

export function rankingForPrecision(precision: LocationPrecision): RecommendationMockRanking {
  if (precision === "GPS" || precision === "EXACT") return "distance";
  if (precision === "CITY") return "city";
  if (precision === "NONE") return "no-location";
  return "district";
}

export function createRecommendationFixture(
  serviceType: RecommendationServiceType,
  count: RecommendationMockCount = 1,
  ranking: RecommendationMockRanking = "district",
): RecommendationResponse {
  const envelope = ranking === "district" ? districtFixtures[serviceType] : serviceType === "HOME_CARE" ? homeCareVariants[ranking] : null;
  if (!envelope) {
    throw new Error(`Mock：此服務尚無「${scenarioNames[ranking]}」測試資料（fixture 缺口，已回報 J-002），請改用居家照顧或行政區情境。`);
  }
  const contractData = envelope.data;
  // Contract fixtures are returned as-is; only the provider list is shortened to test 0–3 results.
  // The empty-state notice comes from API_CONTRACT §9 "Empty Response".
  return {
    ...structuredClone(contractData),
    providers: structuredClone(contractData.providers.slice(0, count)),
    notice: count === 0 && contractData.providers.length > 0
      ? "目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。"
      : contractData.notice,
  };
}
