import { createHash } from "node:crypto";
import type {
  AssessmentRepository,
  ProviderRepository,
  RecommendationRepository,
  SessionRepository,
} from "../repositories/types.js";
import type {
  Provider,
  ProviderServiceType,
  RankingType,
  RecommendationItem,
  RecommendationProviderResult,
  RecommendationResult,
  RecommendationRun,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import { requireOwnedResource, requireValidSession } from "./sessionSecurityService.js";

// 依 PRODUCT_SPEC §17：AI／LLM 完全不參與挑選，全部由本檔的規則決定，可重現、可測試。

const PROVIDER_SERVICE_TYPES: ProviderServiceType[] = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"];

// 依 contracts/mock/recommendations/**（2026-09-24 核准，D-13a-c）的措辭逐字比對。
const SERVICE_TYPE_LABEL: Record<ProviderServiceType, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

const NOTICE = {
  DISTANCE: "以下結果依您提供的位置與需求進行初步推薦。",
  DISTRICT_ROTATION: "目前依您提供的行政區推薦符合條件的服務單位。因尚未提供精確位置，此結果並非依實際距離排序。",
  // D-13c：精確位置但候選缺已驗證座標，整批改行政區推薦。
  DISTRICT_ROTATION_MISSING_COORDINATES: "部分服務單位尚無已確認的位置資料，本次改依您選擇的行政區推薦，並非依實際距離排序。",
  CITY_ROTATION:
    "目前只依您提供的縣市推薦，並非依實際距離排序，也不代表能服務您所在的行政區。補充行政區後可取得更適合的推薦。",
  NO_LOCATION: "您尚未提供位置，因此無法推薦服務單位。提供縣市或行政區後，可以取得符合服務範圍的推薦。",
  EMPTY: "目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。",
} as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// Haversine 直線距離（公里），WGS84 平均地球半徑。不得用未驗證座標、地址或行政區中心點推估（API_CONTRACT §9）。
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 依 MVP_DECISIONS D-13f：sha256(sessionId|city|district|date|providerId)，date 為 Asia/Taipei
// 的 YYYY-MM-DD；CITY_ROTATION 的 seed 不含 district（呼叫端傳 null 時省略該欄位）。
export function stableRotationHash(parts: Array<string | null>): string {
  const seed = parts.filter((p): p is string => p !== null).join("|");
  return createHash("sha256").update(seed).digest("hex");
}

function taipeiDateString(): string {
  return nowTaipeiISOString().slice(0, 10);
}

function hasVerifiedCoordinates(provider: Provider): boolean {
  return provider.lat !== null && provider.lng !== null;
}

export interface RecommendationDeps {
  sessionRepo: SessionRepository;
  assessmentRepo: AssessmentRepository;
  providerRepo: ProviderRepository;
  recommendationRepo: RecommendationRepository;
}

// 依 tasks/TASK-B-005.md + docs/API_CONTRACT.md 第 9 節：POST /api/v1/recommendations。
export async function createRecommendation(
  deps: RecommendationDeps,
  body: unknown,
  sessionTokenHeader: unknown
): Promise<RecommendationResult> {
  const session = await requireValidSession(deps.sessionRepo, sessionTokenHeader);

  if (typeof body !== "object" || body === null) {
    throw new AppError("INVALID_REQUEST", "請求格式錯誤。");
  }
  const input = body as Record<string, unknown>;

  if (!isNonEmptyString(input.assessmentId)) {
    throw new AppError("VALIDATION_ERROR", "缺少有效的 assessmentId。");
  }
  if (!isOneOf(input.serviceType, PROVIDER_SERVICE_TYPES)) {
    throw new AppError("VALIDATION_ERROR", "serviceType 不合法。");
  }
  const assessmentId = input.assessmentId;
  const serviceType = input.serviceType;

  const assessment = await deps.assessmentRepo.findById(assessmentId);
  if (!assessment) {
    throw new AppError("NOT_FOUND", "找不到指定的評估結果。");
  }
  // 跨 session 的 assessmentId 一律回 NOT_FOUND，不透露資源是否存在（ARCHITECTURE §20.3 第 4 步）。
  requireOwnedResource(assessment.sessionId, session, "找不到指定的評估結果。");

  const precision = assessment.locationPrecision;
  const knowledgeVersion = assessment.knowledgeVersion;

  let rankingType: RankingType;
  let candidates: Provider[] = [];
  // 是否用行政區做服務範圍比對（決定 reasons 的「服務範圍包含 X」措辭與 DISTRICT_ROTATION 的 notice 分支）。
  let matchedByDistrict = false;

  if (precision === "NONE") {
    rankingType = "NO_LOCATION";
  } else if (precision === "CITY") {
    candidates = await deps.providerRepo.findEligibleForRecommendation({
      serviceType,
      city: assessment.city,
      district: null,
    });
    rankingType = "CITY_ROTATION";
  } else if (precision === "DISTRICT") {
    candidates = await deps.providerRepo.findEligibleForRecommendation({
      serviceType,
      city: assessment.city,
      district: assessment.district,
    });
    rankingType = "DISTRICT_ROTATION";
    matchedByDistrict = true;
  } else {
    // GPS／EXACT：所有候選都有已驗證座標才走 DISTANCE，否則整批退回 DISTRICT_ROTATION（D-13c）。
    candidates = await deps.providerRepo.findEligibleForRecommendation({
      serviceType,
      city: assessment.city,
      district: assessment.district,
    });
    matchedByDistrict = true;
    rankingType = candidates.length > 0 && candidates.every(hasVerifiedCoordinates) ? "DISTANCE" : "DISTRICT_ROTATION";
  }

  const top3 = selectTop3(rankingType, candidates, {
    sessionId: session.id,
    city: assessment.city,
    district: assessment.district,
    lat: assessment.lat,
    lng: assessment.lng,
  });

  const reasonsBase = matchedByDistrict
    ? `服務範圍包含${assessment.district}`
    : `服務範圍包含${assessment.city}部分行政區`;

  const now = nowTaipeiISOString();
  const recommendationId = generateId("REC");

  const items: RecommendationItem[] = top3.map(({ provider, distanceKm }, index) => {
    const rank = (index + 1) as 1 | 2 | 3;
    const reasons = [reasonsBase, `提供您需要的${SERVICE_TYPE_LABEL[serviceType]}服務`];
    if (rankingType === "DISTANCE" && distanceKm !== null) {
      reasons.push(`距離約 ${distanceKm} 公里`);
    }
    return {
      id: generateId("RECI"),
      recommendationRunId: recommendationId,
      providerId: provider.id,
      rank,
      score: 100 - (rank - 1) * 10,
      distanceKm: rankingType === "DISTANCE" ? distanceKm : null,
      reasons,
      createdAt: now,
    };
  });

  const run: RecommendationRun = {
    id: recommendationId,
    assessmentId: assessment.id,
    serviceType,
    rankingType,
    locationPrecision: precision,
    knowledgeVersion,
    createdAt: now,
  };

  await deps.recommendationRepo.insertRun(run);
  await deps.recommendationRepo.insertItems(items);

  const providers: RecommendationProviderResult[] = items.map((item) => {
    const provider = top3.find((c) => c.provider.id === item.providerId)!.provider;
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      address: provider.address,
      district: provider.district,
      phone: provider.phone,
      website: provider.website,
      googleMapsUrl: provider.googleMapsUrl,
      verified: provider.verified,
      rank: item.rank,
      distanceKm: item.distanceKm,
      reasons: item.reasons,
    };
  });

  const notice =
    rankingType === "NO_LOCATION"
      ? NOTICE.NO_LOCATION
      : providers.length === 0
        ? NOTICE.EMPTY
        : rankingType === "DISTANCE"
          ? NOTICE.DISTANCE
          : rankingType === "CITY_ROTATION"
            ? NOTICE.CITY_ROTATION
            : precision === "DISTRICT"
              ? NOTICE.DISTRICT_ROTATION
              : NOTICE.DISTRICT_ROTATION_MISSING_COORDINATES;

  return {
    recommendationId,
    serviceType,
    rankingType,
    locationPrecision: precision,
    providers,
    notice,
  };
}

interface RankedCandidate {
  provider: Provider;
  distanceKm: number | null;
}

interface RotationSeed {
  sessionId: string;
  city: string;
  district: string;
  lat: number | null;
  lng: number | null;
}

// 依 rankingType 排序並取前 3 名。DISTANCE：Haversine 由近到遠，同距離依 providerId 升冪。
// DISTRICT_ROTATION／CITY_ROTATION：D-13f 穩定輪替雜湊由小到大；CITY_ROTATION 的 seed 不含 district。
function selectTop3(rankingType: RankingType, candidates: Provider[], seed: RotationSeed): RankedCandidate[] {
  if (rankingType === "NO_LOCATION") return [];

  if (rankingType === "DISTANCE") {
    const withDistance = candidates.map((provider) => ({
      provider,
      distanceKm: roundTo1Decimal(haversineKm(seed.lat as number, seed.lng as number, provider.lat as number, provider.lng as number)),
    }));
    withDistance.sort((a, b) => (a.distanceKm !== b.distanceKm ? a.distanceKm - b.distanceKm : a.provider.id.localeCompare(b.provider.id)));
    return withDistance.slice(0, 3);
  }

  const date = taipeiDateString();
  const withHash = candidates.map((provider) => ({
    provider,
    distanceKm: null,
    hash: stableRotationHash([
      seed.sessionId,
      seed.city,
      rankingType === "CITY_ROTATION" ? null : seed.district,
      date,
      provider.id,
    ]),
  }));
  withHash.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  return withHash.slice(0, 3).map(({ provider, distanceKm }) => ({ provider, distanceKm }));
}

function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}
