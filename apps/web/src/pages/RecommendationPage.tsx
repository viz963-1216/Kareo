import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { mockApi } from "../api/mockAdapter";
import type { RecommendationMockCount } from "../api/recommendationMockFixtures";
import { ProviderCard } from "../components/ProviderCard";
import type {
  AsyncStatus,
  RecommendationResponse,
  RecommendationServiceType,
} from "../types/api";

const serviceLabels: Record<RecommendationServiceType, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

const recommendationServices = Object.keys(serviceLabels) as RecommendationServiceType[];

interface Props {
  assessmentId: string | null;
}

function readMockCount(value: string | null): RecommendationMockCount {
  if (value === null) return 1;
  const numberValue = Number(value);
  return numberValue === 0 || numberValue === 2 || numberValue === 3 ? numberValue : 1;
}

export function RecommendationPage({ assessmentId }: Props) {
  const { serviceType: routeServiceType } = useParams();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState("");
  const serviceType = recommendationServices.find((value) => value === routeServiceType);

  useEffect(() => {
    if (!assessmentId || !serviceType) return;

    let active = true;
    setStatus("loading");
    setError("");
    setRecommendation(null);

    mockApi.getRecommendation(
      { assessmentId, serviceType },
      {
        providerCount: readMockCount(searchParams.get("mockProviders")),
        ranking: searchParams.get("mockRanking") === "distance" ? "distance" : "district",
        simulateError: searchParams.get("mockState") === "error",
      },
    ).then((response) => {
      if (!active) return;
      setRecommendation(response);
      setStatus(response.providers.length === 0 ? "empty" : "success");
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "目前無法取得推薦，請稍後再試或聯絡 1966。");
      setStatus("error");
    });

    return () => {
      active = false;
    };
  }, [assessmentId, searchParams, serviceType]);

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

  return (
    <main id="main-content" className="content recommendation-page" aria-busy={status === "loading"}>
      <p className="eyebrow">服務單位推薦</p>
      <h1>{serviceLabels[serviceType]}服務單位</h1>
      <p>以下結果是依目前評估資料提供的初步推薦，不代表正式資格、核定或政府認證。</p>

      {status === "loading" && (
        <section className="loading" role="status">
          正在取得符合條件的服務單位，請稍候。
        </section>
      )}

      {status === "error" && (
        <section className="error" role="alert">
          <h2>暫時無法取得推薦</h2>
          <p>{error}</p>
          <Link className="button secondary" to="/result">返回初步結果</Link>
        </section>
      )}

      {(status === "success" || status === "empty") && recommendation && (
        <>
          <section className="recommendation-notice" aria-label="推薦方式說明">
            <h2>推薦方式說明</h2>
            <p>{recommendation.notice}</p>
            {recommendation.rankingType === "DISTRICT_ROTATION" && (
              <p>本次依行政區提供符合條件的服務單位，並非依實際距離排序。</p>
            )}
          </section>

          {status === "empty" ? (
            <section className="panel empty-state" role="status">
              <h2>目前尚未找到符合條件的服務單位</h2>
              <p>這不代表沒有服務需求。建議稍後再試、查看更多官方資源，或聯絡 1966。</p>
              <Link className="button secondary" to="/result">返回初步結果</Link>
            </section>
          ) : (
            <section aria-label="服務單位推薦結果">
              <p className="result-count">目前顯示 {Math.min(recommendation.providers.length, 3)} 家服務單位</p>
              <div className="provider-grid">
                {recommendation.providers.slice(0, 3).map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="footer-reminder">
        實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。
      </p>
    </main>
  );
}
