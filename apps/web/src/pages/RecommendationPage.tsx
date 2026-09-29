import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, apiMode, isSessionProblem } from "../api";
import { RECOMMENDATION_MOCK_RANKINGS, type RecommendationMockCount } from "../api/mockScenarios";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import { ProviderCard } from "../components/ProviderCard";
import { SessionProblem } from "../components/SessionProblem";
import { useMockState } from "../session/useMockState";
import type {
  AsyncStatus,
  LocationPrecision,
  RecommendationResponse,
  RecommendationServiceType,
} from "../types/api";
import { NoLocationPanel } from "./ResultPage";

const serviceLabels: Record<RecommendationServiceType, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

const recommendationServices = Object.keys(serviceLabels) as RecommendationServiceType[];

interface Props {
  assessmentId: string | null;
  locationPrecision: LocationPrecision | null;
}

function readMockCount(value: string | null): RecommendationMockCount {
  if (value === null) return 1;
  const numberValue = Number(value);
  return numberValue === 0 || numberValue === 2 || numberValue === 3 ? numberValue : 1;
}

/**
 * Explains how this list was ordered, based only on the API's rankingType/locationPrecision
 * (API_CONTRACT v0.2.2 §9). Never says 最近／附近; distance is mentioned only for DISTANCE.
 */
function rankingExplanation({ rankingType, locationPrecision }: RecommendationResponse) {
  switch (rankingType) {
    case "DISTANCE":
      return "依您提供的目前位置，以直線距離的約略值排序；實際路程可能不同。";
    case "DISTRICT_ROTATION":
      return locationPrecision === "GPS" || locationPrecision === "EXACT"
        ? "您有提供目前位置，但部分服務單位尚無已確認的位置資料，因此本次改依您選擇的行政區服務範圍推薦，並非依實際距離排序。"
        : "依您選擇的行政區，列出服務範圍包含該行政區的服務單位。同一天內順序固定、不同日期可能輪替，並非依實際距離排序。";
    case "CITY_ROTATION":
      return "只依您選擇的縣市推薦，並非依距離排序，也不代表能服務您所在的行政區。同一天內順序固定、不同日期可能輪替。";
    case "NO_LOCATION":
      return "您尚未提供位置，因此無法推薦服務單位。";
  }
}

export function RecommendationPage({ assessmentId, locationPrecision }: Props) {
  const { serviceType: routeServiceType } = useParams();
  const [searchParams] = useSearchParams();
  const mockState = useMockState();
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const serviceType = recommendationServices.find((value) => value === routeServiceType);
  // D-13b: without a location the recommendation API is not called.
  const noLocation = locationPrecision === "NONE";
  const mockCount = searchParams.get("mockProviders");
  const mockRanking = RECOMMENDATION_MOCK_RANKINGS.find((value) => value === searchParams.get("mockRanking"));

  useEffect(() => {
    if (!assessmentId || !serviceType || noLocation) return;

    let active = true;
    setStatus("loading");
    setError(null);
    setRecommendation(null);

    api.getRecommendation(
      { assessmentId, serviceType },
      apiMode === "mock" ? { providerCount: readMockCount(mockCount), ranking: mockRanking, state: mockState } : {},
    ).then((response) => {
      if (!active) return;
      setRecommendation(response);
      setStatus(response.providers.length === 0 ? "empty" : "success");
    }).catch((reason) => {
      if (!active) return;
      setError(reason);
      setStatus("error");
    });

    return () => {
      active = false;
    };
  }, [assessmentId, serviceType, noLocation, mockCount, mockRanking, mockState, attempt]);

  if (!assessmentId) {
    return (
      <main id="main-content" className="content">
        <p className="eyebrow">尚無評估資料</p>
        <h1>請先完成初步評估</h1>
        <p>完成評估後，才能依照護需求查看可能適合的服務單位。</p>
        <Link className="button primary" to="/consent">開始評估</Link>
      </main>
    );
  }

  if (!serviceType) {
    return (
      <main id="main-content" className="content">
        <p className="eyebrow">無法顯示推薦</p>
        <h1>不支援這個服務類型</h1>
        <p>請返回初步結果，重新選擇需要查看的服務。</p>
        <Link className="button primary" to="/result">返回初步結果</Link>
      </main>
    );
  }

  const errorMessage = error instanceof Error ? error.message : "目前無法取得推薦，請稍後再試或聯絡 1966。";
  const shown = recommendation?.providers.slice(0, 3) ?? [];

  return (
    <main id="main-content" className="content recommendation-page" aria-busy={status === "loading"}>
      <p className="eyebrow">服務單位推薦</p>
      <h1>{serviceLabels[serviceType]}服務單位</h1>
      <p>以下結果是依目前評估資料提供的初步推薦，不代表正式資格、核定或政府認證，也不代表服務單位已同意接案。</p>
      <FormalAssessmentReminder />

      {noLocation && <NoLocationPanel />}

      {status === "loading" && (
        <section className="loading" role="status">
          正在取得符合條件的服務單位，請稍候。
        </section>
      )}

      {status === "error" && (isSessionProblem(error) ? <SessionProblem message={errorMessage} /> : (
        <section className="error" role="alert">
          <h2>暫時無法取得推薦</h2>
          <p>{errorMessage}</p>
          <div className="button-row">
            <button type="button" className="button primary" onClick={() => setAttempt((value) => value + 1)}>再試一次</button>
            <Link className="button secondary" to="/result">返回初步結果</Link>
          </div>
        </section>
      ))}

      {(status === "success" || status === "empty") && recommendation && (recommendation.rankingType === "NO_LOCATION" ? <NoLocationPanel /> : (
        <>
          <section className="recommendation-notice" aria-label="推薦方式說明">
            <h2>推薦方式說明</h2>
            <p>{rankingExplanation(recommendation)}</p>
            {recommendation.notice && <p>{recommendation.notice}</p>}
            {recommendation.rankingType === "CITY_ROTATION" && (
              <Link to="/assessment" state={{ focus: "location" }}>補充行政區並重新評估</Link>
            )}
          </section>

          {status === "empty" ? (
            <section className="panel empty-state" role="status">
              <h2>您提供的地區目前沒有符合條件的服務單位</h2>
              <p>這不代表沒有服務需求。建議稍後再試、查看更多官方資源，或聯絡 1966 與所在地長期照顧管理中心。</p>
              <Link className="button secondary" to="/result">返回初步結果</Link>
            </section>
          ) : (
            <section aria-label="服務單位推薦結果">
              <p className="result-count">
                目前顯示 {shown.length} 家服務單位
                {shown.length < 3 && "（只列出符合條件的單位，不會補入其他單位）"}
              </p>
              <div className="provider-grid">
                {shown.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    rankingType={recommendation.rankingType}
                    recommendationId={recommendation.recommendationId}
                    serviceType={recommendation.serviceType}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ))}

      <FormalAssessmentReminder compact />
    </main>
  );
}
