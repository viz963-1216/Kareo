import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api, ApiError, apiMode } from "../api";
import { RESOURCE_LOOKUP_MOCK_SCENARIOS, type ResourceLookupMockScenario } from "../api/mockScenarios";
import { DISTRICTS, isServiceCity } from "../location/location";
import type {
  RecommendationServiceType,
  ResourceAreaFilter,
  ResourceCategory,
  ResourceLookupItem,
  ResourceLookupRequest,
  ResourceLookupResponse,
} from "../types/api";

type LookupCity = "" | "臺北市" | "新北市" | "OTHER";

interface LookupForm {
  resourceCategory: "" | ResourceCategory;
  serviceType: "" | RecommendationServiceType;
  city: LookupCity;
  district: string;
  areaFilter: "" | ResourceAreaFilter;
  includeUnconfirmed: boolean;
  contractCity: "" | "臺北市" | "新北市";
  q: string;
}

const initialForm: LookupForm = {
  resourceCategory: "",
  serviceType: "",
  city: "",
  district: "",
  areaFilter: "",
  includeUnconfirmed: false,
  contractCity: "",
  q: "",
};

const serviceLabels: Record<RecommendationServiceType, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

const resourceLabels: Record<ResourceCategory, string> = {
  SERVICE_PROVIDER: "服務單位",
  ASSISTIVE_DEVICE_CENTER: "輔具資源中心",
};

function safeHttpUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}

type LookupState =
  | { status: "idle" | "loading" }
  | { status: "success" | "empty"; response: ResourceLookupResponse }
  | { status: "unsupported-city" }
  | { status: "error"; message: string };

function readMockScenario(value: string | null): ResourceLookupMockScenario | undefined {
  return RESOURCE_LOOKUP_MOCK_SCENARIOS.find((scenario) => scenario === value) as ResourceLookupMockScenario | undefined;
}

function ResourceCard({ item, from }: { item: ResourceLookupItem; from: string }) {
  const websiteUrl = safeHttpUrl(item.website);
  const mapsUrl = safeHttpUrl(item.googleMapsUrl);

  return (
    <article className="resource-card" aria-labelledby={`resource-${item.id}`}>
      <p className="provider-type">{resourceLabels[item.resourceCategory]}</p>
      <h3 id={`resource-${item.id}`}>{item.name}</h3>
      <dl className="provider-details">
        <div><dt>服務</dt><dd>{item.services.length ? item.services.map((service) => serviceLabels[service]).join("、") : "不適用"}</dd></div>
        <div><dt>所在地</dt><dd>{item.city} {item.district}</dd></div>
        <div><dt>地址</dt><dd>{item.address}</dd></div>
        <div><dt>電話</dt><dd><a href={`tel:${item.phone}`}>{item.phone}</a></dd></div>
      </dl>
      <p className="verification-note">{item.verified ? "平台已確認基本資料" : "基本資料尚未經平台確認"}；此標示不代表政府認證。</p>
      {item.serviceAreaStatus === "UNCONFIRMED" && <p className="area-status unconfirmed">服務範圍待確認，請洽機構</p>}
      {item.contractRegions.length > 0 && (
        <ul className="contract-region-list" aria-label="特約縣市">
          {item.contractRegions.map((region) => <li key={`${region.city}-${region.serviceType}`}>列於{region.city}輔具特約廠商名單</li>)}
        </ul>
      )}
      <div className="card-actions">
        <Link className="button primary" to={`/providers/${encodeURIComponent(item.id)}`} state={{ from, source: "resource-lookup" }}>查看詳細資料</Link>
        {websiteUrl && <a className="button secondary" href={websiteUrl} target="_blank" rel="noopener noreferrer">官方網站（開啟新分頁）</a>}
        {mapsUrl && <a className="button secondary" href={mapsUrl} target="_blank" rel="noopener noreferrer">Google Maps（開啟新分頁）</a>}
      </div>
      {!websiteUrl && <p className="field-hint">未提供可使用的官方網站連結。</p>}
      {!mapsUrl && <p className="field-hint">地圖連結暫時無法使用，請洽機構確認。</p>}
    </article>
  );
}

export function buildResourceLookupRequest(form: LookupForm, page = 1): ResourceLookupRequest | null {
  if (form.city === "OTHER") return null;
  const q = form.q.trim();
  return {
    ...(form.resourceCategory ? { resourceCategory: form.resourceCategory } : {}),
    ...(form.serviceType ? { serviceType: form.serviceType } : {}),
    ...(isServiceCity(form.city) ? { city: form.city } : {}),
    ...(form.district ? { district: form.district } : {}),
    ...(form.areaFilter ? { areaFilter: form.areaFilter } : {}),
    ...(form.areaFilter === "SERVICE_AREA" && form.includeUnconfirmed ? { includeUnconfirmed: true } : {}),
    ...(form.contractCity ? { contractCity: form.contractCity } : {}),
    ...(q ? { q } : {}),
    page,
    pageSize: 20,
  };
}

export function ResourceLookupPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [form, setForm] = useState<LookupForm>(initialForm);
  const [submittedForm, setSubmittedForm] = useState<LookupForm>(initialForm);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const mockScenario = apiMode === "mock" ? readMockScenario(searchParams.get("lookupMock")) : undefined;
  const districts = useMemo(() => isServiceCity(form.city) ? DISTRICTS[form.city] : [], [form.city]);
  const from = location.pathname + location.search;

  useEffect(() => {
    const request = buildResourceLookupRequest(submittedForm, page);
    if (!request) {
      setState({ status: "unsupported-city" });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    const effectiveMockScenario = mockScenario === "service-area" && request.includeUnconfirmed
      ? "service-area-unconfirmed"
      : mockScenario === "service-area-unconfirmed" && !request.includeUnconfirmed
        ? "service-area"
        : mockScenario;
    api.getProviders(request, effectiveMockScenario).then((response) => {
      if (active) setState({ status: response.items.length ? "success" : "empty", response });
    }).catch((reason) => {
      if (!active) return;
      const message = reason instanceof ApiError || reason instanceof Error
        ? reason.message
        : "目前無法取得長照資源，請稍後再試或聯絡 1966。";
      setState({ status: "error", message });
    });
    return () => { active = false; };
  }, [submittedForm, page, mockScenario, attempt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedForm(form);
  }

  function setIncludeUnconfirmed(includeUnconfirmed: boolean) {
    const nextForm: LookupForm = {
      ...submittedForm,
      areaFilter: "SERVICE_AREA",
      includeUnconfirmed,
    };
    setForm(nextForm);
    setSubmittedForm(nextForm);
    setPage(1);
  }

  return (
    <main id="main-content" className="content resource-lookup-page" aria-busy={state.status === "loading"}>
      <p className="eyebrow">公開資訊查詢</p>
      <h1>查詢長照資源</h1>
      <p className="lead">不需先做評估，即可查詢 Kareo 收錄的雙北服務單位與公共資源。</p>
      <p className="field-hint">查詢結果僅供聯絡與資訊參考，不代表能到府服務。若要提出媒合需求，請先完成免費評估。</p>

      <form className="resource-filter-form" onSubmit={submit}>
        <fieldset>
          <legend>篩選條件</legend>
          <label>
            資源類別
            <select value={form.resourceCategory} onChange={(event) => {
              const resourceCategory = event.target.value as LookupForm["resourceCategory"];
              setForm((current) => ({
                ...current,
                resourceCategory,
                serviceType: resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? "" : current.serviceType,
              }));
            }}>
              <option value="">全部資源</option>
              <option value="SERVICE_PROVIDER">服務單位</option>
              <option value="ASSISTIVE_DEVICE_CENTER">輔具資源中心</option>
            </select>
          </label>
          <label>
            服務類別
            <select
              value={form.serviceType}
              disabled={form.resourceCategory === "ASSISTIVE_DEVICE_CENTER"}
              aria-describedby={form.resourceCategory === "ASSISTIVE_DEVICE_CENTER" ? "center-service-hint" : undefined}
              onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value as LookupForm["serviceType"] }))}
            >
              <option value="">全部服務</option>
              {Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {form.resourceCategory === "ASSISTIVE_DEVICE_CENTER" && <span id="center-service-hint" className="field-hint">輔具資源中心不適用服務類別篩選。</span>}
          </label>
          <label>
            縣市
            <select value={form.city} onChange={(event) => {
              const city = event.target.value as LookupCity;
              setForm((current) => ({
                ...current,
                city,
                district: "",
                areaFilter: isServiceCity(city) ? current.areaFilter : "",
                includeUnconfirmed: isServiceCity(city) && current.areaFilter === "SERVICE_AREA" ? current.includeUnconfirmed : false,
              }));
            }}>
              <option value="">不限縣市</option>
              <option value="臺北市">臺北市</option>
              <option value="新北市">新北市</option>
              <option value="OTHER">其他縣市</option>
            </select>
          </label>
          <label>
            行政區
            <select value={form.district} disabled={!isServiceCity(form.city)} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}>
              <option value="">不限行政區</option>
              {districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <label>
            地區篩選方式
            <select value={form.areaFilter} disabled={!isServiceCity(form.city)} onChange={(event) => {
              const areaFilter = event.target.value as LookupForm["areaFilter"];
              setForm((current) => ({
                ...current,
                areaFilter,
                includeUnconfirmed: areaFilter === "SERVICE_AREA" ? current.includeUnconfirmed : false,
              }));
            }}>
              <option value="">使用預設（機構所在地）</option>
              <option value="LOCATED_IN">依機構所在地</option>
              <option value="SERVICE_AREA">依已確認服務範圍</option>
            </select>
          </label>
          <label>
            特約縣市
            <select value={form.contractCity} onChange={(event) => setForm((current) => ({ ...current, contractCity: event.target.value as LookupForm["contractCity"] }))}>
              <option value="">不限特約縣市</option>
              <option value="臺北市">臺北市</option>
              <option value="新北市">新北市</option>
            </select>
          </label>
          <label className="full-row">
            名稱關鍵字
            <input type="search" maxLength={50} value={form.q} onChange={(event) => setForm((current) => ({ ...current, q: event.target.value }))} placeholder="輸入機構或資源名稱" />
          </label>
        </fieldset>
        <div className="button-row">
          <button className="button primary" type="submit" disabled={state.status === "loading"}>查詢</button>
          <button className="button secondary" type="button" onClick={() => { setForm(initialForm); setSubmittedForm(initialForm); setPage(1); }}>清除條件</button>
        </div>
      </form>

      {state.status === "loading" && <section className="loading" role="status">正在查詢長照資源，請稍候。</section>}
      {state.status === "unsupported-city" && (
        <section className="panel empty-state" role="status"><h2>本階段只提供臺北市、新北市</h2><p>其他縣市可聯絡 1966 長照專線洽詢。</p></section>
      )}
      {state.status === "error" && (
        <section className="error" role="alert"><h2>暫時無法取得資料</h2><p>{state.message}</p><button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>再試一次</button></section>
      )}
      {(state.status === "success" || state.status === "empty") && (
        <section className="resource-results" aria-live="polite">
          <h2>查詢結果</h2>
          <p className="result-count">共 {state.response.totalCount} 筆</p>
          <div className="resource-notice"><p>{state.response.notice}</p></div>
          {state.response.appliedFilters.areaFilter === "SERVICE_AREA"
            && typeof state.response.unconfirmedCount === "number"
            && state.response.unconfirmedCount > 0 && (
              <label className="checkbox unconfirmed-toggle">
                <input
                  type="checkbox"
                  checked={submittedForm.includeUnconfirmed}
                  onChange={(event) => setIncludeUnconfirmed(event.target.checked)}
                />
                一併顯示服務範圍待確認的 {state.response.unconfirmedCount} 家
              </label>
            )}
          {state.status === "success" && (
            (() => {
              const verifiedItems = state.response.items.filter((item) => item.serviceAreaStatus !== "UNCONFIRMED");
              const unconfirmedItems = state.response.items.filter((item) => item.serviceAreaStatus === "UNCONFIRMED");
              const serviceAreaLookup = state.response.appliedFilters.areaFilter === "SERVICE_AREA";
              return (
                <>
                  {verifiedItems.length > 0 && (
                    <section className="resource-group" aria-labelledby="verified-resource-heading">
                      <h3 id="verified-resource-heading">{serviceAreaLookup ? "已確認服務範圍" : "資源列表"}</h3>
                      <div className="resource-grid">
                        {verifiedItems.map((item) => <ResourceCard key={item.id} item={item} from={from} />)}
                      </div>
                    </section>
                  )}
                  {unconfirmedItems.length > 0 && (
                    <section className="resource-group unconfirmed-group" aria-labelledby="unconfirmed-resource-heading">
                      <h3 id="unconfirmed-resource-heading">服務範圍待確認</h3>
                      <p>以下機構的服務範圍尚待確認，請直接洽詢機構。</p>
                      <div className="resource-grid">
                        {unconfirmedItems.map((item) => <ResourceCard key={item.id} item={item} from={from} />)}
                      </div>
                    </section>
                  )}
                </>
              );
            })()
          )}
          {state.status === "empty" && <div className="panel empty-state" role="status"><p>目前沒有符合條件的資源，請調整篩選條件。</p></div>}
          <nav className="pagination" aria-label="查詢結果分頁">
            <button className="button secondary" type="button" disabled={state.response.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一頁</button>
            <span>
              第 {state.response.page} 頁
              {state.response.totalCount > 0 && `，共 ${Math.max(1, Math.ceil(state.response.totalCount / state.response.pageSize))} 頁`}
            </span>
            <button
              className="button secondary"
              type="button"
              disabled={state.response.page * state.response.pageSize >= state.response.totalCount}
              onClick={() => setPage((value) => value + 1)}
            >下一頁</button>
          </nav>
        </section>
      )}
    </main>
  );
}
