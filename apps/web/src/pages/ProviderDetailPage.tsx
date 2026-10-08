import { demoMode } from "../demo";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { LeadSelection } from "../components/ProviderCard";
import type { ProviderDetail } from "../types/api";

const labels: Record<ProviderDetail["type"], string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
  OTHER: "其他服務",
};

const resourceCategoryLabels: Record<ProviderDetail["resourceCategory"], string> = {
  SERVICE_PROVIDER: "服務單位",
  ASSISTIVE_DEVICE_CENTER: "輔具資源中心",
};

function safeWebUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

type DetailState =
  | { status: "loading" }
  | { status: "success"; provider: ProviderDetail }
  | { status: "not-found" }
  | { status: "error"; message: string };

function isLeadSelection(value: unknown): value is LeadSelection {
  if (typeof value !== "object" || value === null) return false;
  const selection = value as Record<string, unknown>;
  return typeof selection.providerId === "string"
    && typeof selection.providerName === "string"
    && typeof selection.district === "string"
    && typeof selection.serviceType === "string"
    && ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE"].includes(selection.serviceType)
    && typeof selection.recommendationId === "string"
    && typeof selection.from === "string";
}

export function ProviderDetailPage() {
  const { providerId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const simulateError = searchParams.get("mockState") === "error";
  const from: unknown = location.state?.from;
  const leadSelection = isLeadSelection(location.state?.lead) ? location.state.lead : null;
  const fromResourceLookup = location.state?.source === "resource-lookup"
    && typeof from === "string"
    && /^\/resources(\?|$)/.test(from);
  const fromRecommendation = typeof from === "string"
    && /^\/recommendations\/(HOME_CARE|HOME_MEDICAL_NURSING|ASSISTIVE_DEVICE)(\?|$)/.test(from);
  const returnTo = fromResourceLookup || fromRecommendation ? from as string : "/";

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    api.getProvider(providerId, simulateError).then((provider) => {
      if (active) setState(provider ? { status: "success", provider } : { status: "not-found" });
    }).catch(() => {
      if (active) setState({ status: "error", message: "目前無法取得服務單位資料，請稍後再試或聯絡 1966。" });
    });
    return () => { active = false; };
  }, [providerId, simulateError]);

  const provider = state.status === "success" ? state.provider : null;
  const mapsUrl = safeWebUrl(provider?.googleMapsUrl ?? null);
  const websiteUrl = safeWebUrl(provider?.website ?? null);

  return (
    <main id="main-content" className="content provider-detail-page" aria-busy={state.status === "loading"}>
      <p className="eyebrow">{fromResourceLookup ? "長照資源詳細資料" : "服務單位詳細資料"}</p>
      <h1>{provider?.name ?? (fromResourceLookup ? "長照資源資料" : "服務單位資料")}</h1>
      {state.status === "loading" && <section className="loading" role="status">正在取得詳細資料，請稍候。</section>}
      {state.status === "not-found" && <section className="panel empty-state" role="status"><h2>找不到這項資源</h2><p>目前沒有這項資源的詳細資料，請返回重新選擇。</p></section>}
      {state.status === "error" && <section className="error" role="alert"><h2>暫時無法取得資料</h2><p>{state.message}</p></section>}
      {provider && <>
        <section className="panel" aria-label="基本資料">
          <h2>基本資料</h2>
          <dl className="provider-details">
            <div><dt>資源類別</dt><dd>{resourceCategoryLabels[provider.resourceCategory]}</dd></div>
            <div><dt>類型</dt><dd>{labels[provider.type]}</dd></div>
            <div><dt>所在地</dt><dd>{provider.city} {provider.district}</dd></div>
            <div><dt>地址</dt><dd>{provider.address}</dd></div>
            <div><dt>電話</dt><dd><a href={`tel:${provider.phone}`}>{provider.phone}</a></dd></div>
            <div><dt>網站</dt><dd>{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noopener noreferrer">前往官方網站（開啟新分頁）</a> : provider.website ? "網站連結暫時無法使用" : "未提供網站"}</dd></div>
          </dl>
          <p className="verification-note">{provider.verified ? "平台已確認基本資料" : "基本資料尚未經平台確認"}；此標示不代表政府認證。</p>
          {provider.contractRegions.length > 0 && (
            <>
              <ul className="contract-region-list" aria-label="特約縣市">
                {provider.contractRegions.map((region) => <li key={`${region.city}-${region.serviceType}`}>列於{region.city}輔具特約廠商名單</li>)}
              </ul>
              <p className="field-hint">長照輔具補助須向核定縣市的特約廠商購置；特約名單不代表能到府或服務您所在的行政區。</p>
            </>
          )}
        </section>
        <section className="panel"><h2>服務項目</h2>{provider.services.length ? <ul>{provider.services.map((service, index) => <li key={`${service}-${index}`}>{labels[service]}</li>)}</ul> : <p>尚未提供服務項目資料。</p>}</section>
        <section className="panel">
          <h2>服務範圍</h2>
          {provider.serviceAreaStatus === "UNCONFIRMED"
            ? <p className="area-status unconfirmed">服務範圍待確認，請洽機構</p>
            : provider.serviceAreas.length
              ? <ul>{provider.serviceAreas.map((area, index) => <li key={`${area.city}-${area.district}-${index}`}>{area.city} {area.district}</li>)}</ul>
              : <p>尚未提供服務範圍資料，請洽機構確認。</p>}
        </section>
        <section className="panel"><h2>Google Maps</h2>{mapsUrl ? <a className="button secondary" href={mapsUrl} target="_blank" rel="noopener noreferrer">在 Google Maps 查看（開啟新分頁）</a> : <p>地圖連結暫時無法使用，請洽服務單位確認。</p>}</section>
        {!demoMode && !fromResourceLookup && provider.resourceCategory !== "ASSISTIVE_DEVICE_CENTER" && leadSelection && leadSelection.providerId === provider.id && (
          <section className="panel lead-cta">
            <h2>需要協助聯繫？</h2>
            <p>您可以留下稱呼與電話，提出這個服務單位的媒合需求。</p>
            <Link className="button primary" to="/match" state={leadSelection}>我要媒合</Link>
          </section>
        )}
        {!demoMode && fromResourceLookup && provider.resourceCategory !== "ASSISTIVE_DEVICE_CENTER" && (
          <section className="panel assessment-cta">
            <h2>如需媒合，請先完成免費評估</h2>
            <p>資源查詢僅提供公開資訊；完成免費初步評估後，再依需求查看服務單位。</p>
            <Link className="button primary" to="/consent">開始免費長照評估</Link>
          </section>
        )}
      </>}
      <div className="detail-navigation"><Link className="button secondary" to={returnTo}>{fromResourceLookup ? "返回查詢結果" : fromRecommendation ? "返回推薦結果" : "返回首頁"}</Link></div>
      <p className="footer-reminder">實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。</p>
    </main>
  );
}
