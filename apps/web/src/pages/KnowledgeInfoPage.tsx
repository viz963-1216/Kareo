import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import { LongTermCareContact } from "../components/LongTermCareContact";
import { initialKnowledgeFilters, knowledgeRequest, knowledgeSummaryParagraphs, previousKnowledgePage, type KnowledgeFilters } from "../knowledge/knowledgeInfo";
import { knowledgeFailure, publicDate } from "../knowledge/knowledgeStatus";
import { KNOWLEDGE_MOCK_SCENARIOS, type KnowledgeMockScenario } from "../api/mockScenarios";
import type { KnowledgeCategory, KnowledgeRecordsResponse, PublicKnowledgeRecord } from "../types/api";

const categoryLabels: Record<KnowledgeCategory, string> = {
  ELIGIBILITY: "申請資格", BENEFIT: "長照給付", COPAY: "部分負擔", TRANSPORTATION: "交通接送",
  HOME_MEDICAL_NURSING: "居家醫療與護理", APPLICATION: "申請方式", ASSISTIVE_DEVICE: "輔具與無障礙",
  RESPITE: "喘息服務", HOME_CARE: "居家照顧", OTHER: "其他資訊",
};
const jurisdictionLabels = { TAIWAN: "全國", TAIPEI: "臺北市", NEW_TAIPEI: "新北市" } as const;
export type KnowledgePageState =
  | { status: "loading" | "coming-soon" | "unpublished" | "error" }
  | { status: "success"; response: KnowledgeRecordsResponse };

export function KnowledgeCard({ record }: { record: PublicKnowledgeRecord }) {
  return <article className="knowledge-card">
    <p className="knowledge-meta">{jurisdictionLabels[record.jurisdiction]}・{categoryLabels[record.category]}</p>
    <h2>{record.title}</h2>
    <div className="summary-lines">{knowledgeSummaryParagraphs(record.summary).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    <dl className="knowledge-facts">
      <div><dt>來源機關</dt><dd>{record.source.publisher}</dd></div>
      <div><dt>生效日</dt><dd>{publicDate(record.effectiveFrom)}</dd></div>
      <div><dt>發布日期</dt><dd>{publicDate(record.publishedAt)}</dd></div>
      <div><dt>最後查核</dt><dd>{publicDate(record.lastVerifiedAt)}</dd></div>
      <div><dt>資訊維護</dt><dd>Kareo（依官方資料整理）</dd></div>
      <div><dt>資料來源</dt><dd>{record.source.url
        ? <a href={record.source.url} target="_blank" rel="noopener noreferrer">{record.source.title}（開啟新分頁）</a>
        : record.source.title}</dd></div>
    </dl>
  </article>;
}

export function KnowledgeStatusPanel({ state, onRetry, onClear, hasFilters }: {
  state: KnowledgePageState; onRetry: () => void; onClear: () => void; hasFilters: boolean;
}) {
  if (state.status === "loading") return <p className="loading" role="status">正在載入長照資訊，請稍候。</p>;
  if (state.status === "success") return state.response.items.length ? null : <section className="panel empty-state" role="status">
    <h2>目前沒有符合條件的資訊</h2><p>這表示本次查詢沒有結果，不代表您不符合資格，也不代表功能尚未開放。</p>
    {hasFilters && <button className="button secondary" type="button" onClick={onClear}>清除篩選，查看全部資訊</button>}
    <LongTermCareContact resources />
  </section>;
  if (state.status === "coming-soon") return <section className="panel" role="status">
    <h2>長照資訊功能籌備中</h2><p>這項功能尚未開放；您仍可查詢長照資源，或向 1966 確認申請方式。</p><LongTermCareContact resources />
  </section>;
  if (state.status === "unpublished") return <section className="panel" role="status">
    <h2>目前沒有已發布的長照資訊</h2><p>目前沒有可用的已發布資料版本。這不代表您不符合資格；請先查詢長照資源，或向 1966 確認。</p><LongTermCareContact resources />
  </section>;
  return <section className="error" role="alert">
    <h2>目前無法載入資訊，請稍後再試</h2><p>查詢暫時失敗，不代表功能未開放。請確認網路後重試，或使用以下替代方式。</p>
    <div className="button-row"><button className="button secondary" type="button" onClick={onRetry}>重新載入資訊</button><Link className="button secondary" to="/">返回首頁</Link></div>
    <LongTermCareContact resources />
  </section>;
}

// Currently available in the public release. An explicit product setting alone can mark COMING_SOON;
// never infer that intention from an HTTP error or an empty response.
export function KnowledgeInfoPage({ availability = "available" }: { availability?: "available" | "coming-soon" }) {
  const [searchParams] = useSearchParams();
  const requestedScenario = searchParams.get("knowledgeMock");
  const scenario = KNOWLEDGE_MOCK_SCENARIOS.includes(requestedScenario as KnowledgeMockScenario) ? requestedScenario as KnowledgeMockScenario : undefined;
  const [form, setForm] = useState<KnowledgeFilters>(initialKnowledgeFilters);
  const [submitted, setSubmitted] = useState<KnowledgeFilters>(initialKnowledgeFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<KnowledgePageState>({ status: availability === "coming-soon" ? "coming-soon" : "loading" });
  const request = useMemo(() => knowledgeRequest(submitted, page), [submitted, page]);
  useEffect(() => {
    if (availability === "coming-soon") { setState({status: "coming-soon"}); return; }
    let active = true;
    setState({ status: "loading" });
    api.getKnowledgeRecords(request, scenario).then(
      response => { if (active) setState({ status: "success", response }); },
      error => { if (active) setState({ status: knowledgeFailure(error) }); },
    );
    return () => { active = false; };
  }, [attempt, request, scenario, availability]);
  function submit(event: FormEvent) { event.preventDefault(); setSubmitted(form); setPage(1); }
  function clearFilters() { setForm(initialKnowledgeFilters); setSubmitted(initialKnowledgeFilters); setPage(1); }
  const filtersUsable = state.status !== "coming-soon" && state.status !== "unpublished";

  return <main id="main-content" className="content knowledge-info-page" aria-busy={state.status === "loading"}>
    <p className="eyebrow">公開資訊查詢</p><h1>長照制度與補助資訊</h1>
    <p>查詢目前可用的制度與補助資訊，作為申請與討論前的準備；不判斷個人資格，也不計算個人可領金額。</p>
    <FormalAssessmentReminder />
    {filtersUsable && <form className="knowledge-filter" onSubmit={submit} aria-label="篩選長照資訊">
      <fieldset><legend>篩選條件</legend>
        <label>適用地區<select value={form.jurisdiction} onChange={event => setForm(current => ({...current, jurisdiction: event.target.value as KnowledgeFilters["jurisdiction"]}))}>
          <option value="">全部</option><option value="TAIWAN">全國</option><option value="TAIPEI">臺北市</option><option value="NEW_TAIPEI">新北市</option>
        </select></label>
        <label>資訊類別<select value={form.category} onChange={event => setForm(current => ({...current, category: event.target.value as KnowledgeFilters["category"]}))}>
          <option value="">全部</option>{Object.entries(categoryLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
      </fieldset>
      <div className="button-row"><button className="button primary" type="submit" disabled={state.status === "loading"}>套用篩選</button><button className="button secondary" type="button" onClick={clearFilters}>清除條件</button></div>
    </form>}
    <KnowledgeStatusPanel state={state} onRetry={() => setAttempt(value => value+1)} onClear={clearFilters} hasFilters={Boolean(submitted.category || submitted.jurisdiction)} />
    {state.status === "success" && <>
      <section className="notice" aria-label="資訊使用提醒"><p>{state.response.notice}</p><p className="knowledge-version">知識版本：{state.response.knowledgeVersion}</p><p className="field-hint">本版發布：{publicDate(state.response.publishedAt)}｜整理維護：Kareo</p></section>
      {state.response.items.length > 0 && <>
        <div className="knowledge-list">{state.response.items.map(record => <KnowledgeCard key={record.id} record={record} />)}</div>
        <nav className="pagination" aria-label="長照資訊分頁"><button className="button secondary" type="button" disabled={state.response.page <= 1} onClick={() => setPage(previousKnowledgePage)}>上一頁</button><span>第 {state.response.page} 頁，共 {Math.max(1,Math.ceil(state.response.totalCount/state.response.pageSize))} 頁</span><button className="button secondary" type="button" disabled={state.response.page * state.response.pageSize >= state.response.totalCount} onClick={() => setPage(value => value+1)}>下一頁</button></nav>
      </>}
    </>}
    <section className="panel knowledge-next-step"><h2>想整理自己或家人的可能需求？</h2><p>可完成免費初步評估，或向 1966 與所在地長期照顧管理中心確認。</p><div className="button-row"><Link className="button secondary" to="/consent">開始免費長照評估</Link><a className="button secondary" href="tel:1966" aria-label="撥打長照專線 1966">撥打長照專線 1966</a></div></section>
  </main>;
}
