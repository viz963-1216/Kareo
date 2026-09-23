import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { ProviderDetail } from "../types/api";

const labels: Record<ProviderDetail["type"], string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
  OTHER: "其他服務",
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

export function ProviderDetailPage() {
  const { providerId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const simulateError = searchParams.get("mockState") === "error";
  const from: unknown = location.state?.from;
  const returnTo = typeof from === "string" && /^\/recommendations\/(HOME_CARE|HOME_MEDICAL_NURSING|ASSISTIVE_DEVICE)(\?|$)/.test(from)
    ? from : "/";

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
      <p className="eyebrow">服務單位詳細資料</p>
      <h1>{provider?.name ?? "服務單位資料"}</h1>
      {state.status === "loading" && <section className="loading" role="status">正在取得服務單位資料，請稍候。</section>}
      {state.status === "not-found" && <section className="panel empty-state" role="status"><h2>找不到這個服務單位</h2><p>目前沒有此服務單位的詳細資料，請返回重新選擇。</p></section>}
      {state.status === "error" && <section className="error" role="alert"><h2>暫時無法取得資料</h2><p>{state.message}</p></section>}
      {provider && <>
        <section className="panel" aria-label="基本資料">
          <h2>基本資料</h2>
          <dl className="provider-details">
            <div><dt>類型</dt><dd>{labels[provider.type]}</dd></div>
            <div><dt>所在地</dt><dd>{provider.city} {provider.district}</dd></div>
            <div><dt>地址</dt><dd>{provider.address}</dd></div>
            <div><dt>電話</dt><dd><a href={`tel:${provider.phone}`}>{provider.phone}</a></dd></div>
            <div><dt>網站</dt><dd>{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noopener noreferrer">前往官方網站（開啟新分頁）</a> : provider.website ? "網站連結暫時無法使用" : "未提供網站"}</dd></div>
          </dl>
          <p className="verification-note">{provider.verified ? "平台已確認基本資料" : "基本資料尚未經平台確認"}；此標示不代表政府認證。</p>
        </section>
        <section className="panel"><h2>服務項目</h2>{provider.services.length ? <ul>{provider.services.map((service, index) => <li key={`${service}-${index}`}>{labels[service]}</li>)}</ul> : <p>尚未提供服務項目資料。</p>}</section>
        <section className="panel"><h2>服務範圍</h2>{provider.serviceAreas.length ? <ul>{provider.serviceAreas.map((area, index) => <li key={`${area.city}-${area.district}-${index}`}>{area.city} {area.district}</li>)}</ul> : <p>尚未提供服務範圍資料，請洽服務單位確認。</p>}</section>
        <section className="panel"><h2>Google Maps</h2>{mapsUrl ? <a className="button secondary" href={mapsUrl} target="_blank" rel="noopener noreferrer">在 Google Maps 查看（開啟新分頁）</a> : <p>地圖連結暫時無法使用，請洽服務單位確認。</p>}</section>
      </>}
      <div className="detail-navigation"><Link className="button secondary" to={returnTo}>{returnTo === "/" ? "返回首頁" : "返回推薦結果"}</Link></div>
      <p className="footer-reminder">實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。</p>
    </main>
  );
}
