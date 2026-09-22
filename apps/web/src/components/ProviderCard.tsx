import type { RecommendationProvider } from "../types/api";

const serviceLabels: Record<RecommendationProvider["type"], string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

export function ProviderCard({ provider }: { provider: RecommendationProvider }) {
  return (
    <article className="provider-card" aria-labelledby={`provider-${provider.id}`}>
      <div className="provider-card-heading">
        <span className="rank-badge" aria-label={`推薦順位第 ${provider.rank} 名`}>
          #{provider.rank}
        </span>
        <div>
          <p className="provider-type">{serviceLabels[provider.type]}</p>
          <h2 id={`provider-${provider.id}`}>{provider.name}</h2>
        </div>
      </div>

      <dl className="provider-details">
        <div>
          <dt>服務地區</dt>
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
        {provider.distanceKm !== null && (
          <div>
            <dt>距離</dt>
            <dd>約 {provider.distanceKm} 公里</dd>
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

      <a
        className="button secondary"
        href={provider.googleMapsUrl}
        target="_blank"
        rel="noreferrer"
      >
        在 Google Maps 查看（開啟新分頁）
      </a>
    </article>
  );
}
