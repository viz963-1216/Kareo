import homeCareDistanceFixture from "../../../../contracts/mock/recommendations/ranking-variants/HOME_CARE-DISTANCE.json";
import assistiveDeviceFixture from "../../../../contracts/mock/recommendations/ASSISTIVE_DEVICE.json";
import homeCareFixture from "../../../../contracts/mock/recommendations/HOME_CARE.json";
import homeMedicalNursingFixture from "../../../../contracts/mock/recommendations/HOME_MEDICAL_NURSING.json";
import type {
  RecommendationEnvelope,
  RecommendationResponse,
  RecommendationServiceType,
} from "../types/api";

export type RecommendationMockCount = 0 | 1 | 2 | 3;
export type RecommendationMockRanking = "district" | "distance";

const recommendationFixtures: Record<RecommendationServiceType, RecommendationEnvelope> = {
  HOME_CARE: homeCareFixture as RecommendationEnvelope,
  HOME_MEDICAL_NURSING: homeMedicalNursingFixture as RecommendationEnvelope,
  ASSISTIVE_DEVICE: assistiveDeviceFixture as RecommendationEnvelope,
};

export function createRecommendationFixture(
  serviceType: RecommendationServiceType,
  count: RecommendationMockCount = 1,
  ranking: RecommendationMockRanking = "district",
): RecommendationResponse {
  if (ranking === "distance" && serviceType !== "HOME_CARE") {
    throw new Error("此服務尚未提供距離排序測試資料，請使用行政區情境。");
  }
  const contractData = ranking === "distance"
    ? (homeCareDistanceFixture as RecommendationEnvelope).data
    : recommendationFixtures[serviceType].data;
  return {
    ...structuredClone(contractData),
    providers: structuredClone(contractData.providers.slice(0, count)),
    notice: count === 0
      ? "目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。"
      : contractData.notice,
  };
}
