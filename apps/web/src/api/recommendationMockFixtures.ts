import contractFixture from "../../../../contracts/mock/recommendation-response.json";
import type {
  RecommendationEnvelope,
  RecommendationProvider,
  RecommendationResponse,
  RecommendationServiceType,
} from "../types/api";

export type RecommendationMockCount = 0 | 1 | 2 | 3;
export type RecommendationMockRanking = "district" | "distance";

const contractData = (contractFixture as unknown as RecommendationEnvelope).data;

const additionalProviders: RecommendationProvider[] = [
  {
    ...contractData.providers[0],
    id: "PROV-MOCK-002",
    name: "測試安心居家服務中心",
    address: "新北市三重區正義北路200號",
    phone: "02-23456789",
    rank: 2,
    reasons: ["服務範圍包含三重區", "提供您需要的居家照顧服務"],
  },
  {
    ...contractData.providers[0],
    id: "PROV-MOCK-003",
    name: "測試樂齡照護中心",
    address: "新北市三重區集美街300號",
    phone: "02-34567890",
    verified: true,
    rank: 3,
    reasons: ["服務範圍包含三重區", "提供您需要的居家照顧服務"],
  },
];

const serviceFixtureContent: Record<
  RecommendationServiceType,
  { label: string; idPrefix: string; providerNames: [string, string, string] }
> = {
  HOME_CARE: {
    label: "居家照顧",
    idPrefix: "PROV-MOCK-",
    providerNames: ["測試居家照顧中心", "測試安心居家服務中心", "測試樂齡照護中心"],
  },
  HOME_MEDICAL_NURSING: {
    label: "居家醫療與護理",
    idPrefix: "PROV-MOCK-MEDICAL-",
    providerNames: ["測試居家醫療護理所", "測試安心居家護理所", "測試樂齡居家醫療中心"],
  },
  ASSISTIVE_DEVICE: {
    label: "輔具",
    idPrefix: "PROV-MOCK-ASSISTIVE-",
    providerNames: ["測試輔具服務中心", "測試安心輔具中心", "測試樂齡輔具中心"],
  },
};

function withServiceType(
  provider: RecommendationProvider,
  serviceType: RecommendationServiceType,
  index: number,
): RecommendationProvider {
  const content = serviceFixtureContent[serviceType];
  return {
    ...provider,
    id: serviceType === "HOME_CARE"
      ? provider.id
      : `${content.idPrefix}${String(index + 1).padStart(3, "0")}`,
    name: content.providerNames[index],
    type: serviceType,
    reasons: ["服務範圍包含三重區", `提供您需要的${content.label}服務`],
  };
}

export function createRecommendationFixture(
  serviceType: RecommendationServiceType,
  count: RecommendationMockCount = 1,
  ranking: RecommendationMockRanking = "district",
): RecommendationResponse {
  const baseProviders = [contractData.providers[0], ...additionalProviders]
    .slice(0, count)
    .map((provider, index) => withServiceType(provider, serviceType, index));

  if (ranking === "distance") {
    const providers = baseProviders.map((provider, index) => ({
      ...provider,
      distanceKm: [1.8, 3.2, 4.6][index],
      reasons: [...provider.reasons, `距離約 ${[1.8, 3.2, 4.6][index]} 公里`],
    }));

    return {
      ...contractData,
      recommendationId: `REC-MOCK-DISTANCE-${count}`,
      serviceType,
      rankingType: "DISTANCE",
      locationPrecision: "GPS",
      providers,
      notice: "以下結果依您提供的位置與需求進行初步推薦。",
    };
  }

  return {
    ...contractData,
    recommendationId: `REC-MOCK-DISTRICT-${count}`,
    serviceType,
    providers: baseProviders,
    notice: count === 0
      ? "目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。"
      : contractData.notice,
  };
}
