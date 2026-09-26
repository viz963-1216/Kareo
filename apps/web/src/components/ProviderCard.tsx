import type { RankingType, RecommendationProvider, RecommendationServiceType } from "../types/api";
import { Link, useLocation } from "react-router-dom";

const serviceLabels: Record<RecommendationProvider["type"], string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

/** What the Lead page needs to link a request to this card (kept in router state, never in the URL). */
export interface LeadSelection {
  providerId: string;
  providerName: string;
  district: string;
  serviceType: RecommendationServiceType;
  recommendationId: string;
  from: string;
}

interface Props {
  provider: RecommendationProvider;
  rankingType: RankingType;
  recommendationId: string;
  serviceType: RecommendationServiceType;
}

export function ProviderCard({ provider, rankingType, recommendationId, serviceType }: Props) {
  const location = useLocation();
  const from = location.pathname + location.search;
  // API_CONTRACT §9: distance is shown only for DISTANCE ranking and only when the API sent a real number.
  const distance = rankingType === "DISTANCE" && typeof provider.distanceKm === "number" && Number.isFinite(provider.distanceKm)
    ? provider.distanceKm : null;
  const lead: LeadSelection = {
    providerId: provider.id,
    providerName: provider.name,
    district: provider.district,
    serviceType,
    recommendationId,
    from,
  };
  return (
    <article className="provider-card" aria-labelledby={`provider-${provider.id}`}>
      <div className="provider-card-heading">
        <span className="rank-badge" aria-label={`推薦順位第 ${provider.rank} 名`}>
          #{provider.rank}
        </span>
        <div>
          <p className="provider-type">{serviceLabels[provider.type] ?? serviceLabels[serviceType]}</p>
          <h2 id={`provider-${provider.id}`}>{provider.name}</h2>
        </div>
      </div>

      <dl className="provider-details">
        <div>
          <dt>所在地區</dt>
          <dd>{provider.district}</dd>
        </div>
        <div>
          <dt>地址</dt>
          <dd>{provider.address}</dd>
        </div>
        <div>
          <dt>電話</dt>
          <dd><a href={`tel:${provider.phone}`}>{provider.phone}</a></dd>
        </div>
        {distance !== null && (
          <div>
            <dt>直線距離</dt>
            <dd>約 {distance} 公里</dd>
          </div>
        )}
      </dl>

      <section className="provider-reasons" aria-label={`${provider.name}的推薦原因`}>
        <h3>推薦原因</h3>
        <ul>
          {provider.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </section>

      <p className="verification-note">
        {provider.verified ? "平台已確認基本資料" : "基本資料尚未經平台確認"}；此標示不代表政府認證。
      </p>

      <div className="card-actions">
        <Link className="button primary" to="/match" state={lead}>
          我要媒合
        </Link>
        <Link className="button secondary" to={`/providers/${encodeURIComponent(provider.id)}`} state={{ from }}>
          查看詳細資料
        </Link>
        <a
          className="button secondary"
          href={provider.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          在 Google Maps 查看（開啟新分頁）
        </a>
      </div>
    </article>
  );
}
