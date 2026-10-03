import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import {
  initialKnowledgeFilters,
  knowledgeRequest,
  knowledgeSummaryParagraphs,
  previousKnowledgePage,
  type KnowledgeFilters,
} from "../knowledge/knowledgeInfo";
import { KNOWLEDGE_MOCK_SCENARIOS, type KnowledgeMockScenario } from "../api/mockScenarios";
import type { KnowledgeCategory, KnowledgeRecordsResponse, PublicKnowledgeRecord } from "../types/api";

const categoryLabels: Record<KnowledgeCategory, string> = {
  ELIGIBILITY: "申請資格",
  BENEFIT: "長照給付",
  COPAY: "部分負擔",
  TRANSPORTATION: "交通接送",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  APPLICATION: "申請方式",
  ASSISTIVE_DEVICE: "輔具與無障礙",
  RESPITE: "喘息服務",
  HOME_CARE: "居家照顧",
  OTHER: "其他資訊",
};

const jurisdictionLabels = { TAIWAN: "全國", TAIPEI: "臺北市", NEW_TAIPEI: "新北市" } as const;

type PageState =
  | { status: "loading" }
  | { status: "success"; response: KnowledgeRecordsResponse }
  | { status: "error"; error: unknown };

function KnowledgeCard({ record }: { record: PublicKnowledgeRecord }) {
  return (
    <article className="knowledge-card">
      <p className="knowledge-meta">{jurisdictionLabels[record.jurisdiction]}・{categoryLabels[record.category]}</p>
      <h2>{record.title}</h2>
      <div className="summary-lines">
        {knowledgeSummaryParagraphs(record.summary).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      <dl className="knowledge-facts">
        <div><dt>發布機關</dt><dd>{record.source.publisher}</dd></div>
        <div><dt>生效日</dt><dd>{record.effectiveFrom}</dd></div>
        <div>
          <dt>資料來源</dt>
          <dd>{record.source.url
            ? <a href={record.source.url} target="_blank" rel="noopener noreferrer">{record.source.title}（開啟新分頁）</a>
            : record.source.title}</dd>
        </div>
      </dl>
    </article>
  );
}

export function KnowledgeInfoPage() {
  const [searchParams] = useSearchParams();
  const requestedScenario = searchParams.get("knowledgeMock");
  const scenario = KNOWLEDGE_MOCK_SCENARIOS.includes(requestedScenario as KnowledgeMockScenario)
    ? requestedScenario as KnowledgeMockScenario
    : undefined;
  const [form, setForm] = useState<KnowledgeFilters>(initialKnowledgeFilters);
  const [submitted, setSubmitted] = useState<KnowledgeFilters>(initialKnowledgeFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const request = useMemo(() => knowledgeRequest(submitted, page), [submitted, page]);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    api.getKnowledgeRecords(request, scenario).then(
      (response) => { if (active) setState({ status: "success", response }); },
      (error) => { if (active) setState({ status: "error", error }); },
    );
    return () => { active = false; };
  }, [attempt, request, scenario]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(form);
    setPage(1);
  }

  const errorMessage = state.status === "error" && state.error instanceof Error
    ? state.error.message
    : "目前無法取得長照資訊，請稍後再試或聯絡 1966。";
  const unavailable = state.status === "error" && state.error instanceof ApiError && state.error.code === "KNOWLEDGE_UNAVAILABLE";

  return (
    <main id="main-content" className="content knowledge-info-page">
      <p className="eyebrow">長照制度與補助資訊</p>
      <h1>瀏覽已審核發布的長照資訊</h1>
      <p>這裡提供制度與補助資訊整理，不判斷個人資格，也不計算個人可領金額。</p>
      <FormalAssessmentReminder />

      <form className="knowledge-filter" onSubmit={submit} aria-label="篩選長照資訊">
        <fieldset>
          <legend>篩選條件</legend>
          <label>適用地區
            <select value={form.jurisdiction} onChange={(event) => setForm((current) => ({ ...current, jurisdiction: event.target.value as KnowledgeFilters["jurisdiction"] }))}>
              <option value="">全部</option><option value="TAIWAN">全國</option><option value="TAIPEI">臺北市</option><option value="NEW_TAIPEI">新北市</option>
            </select>
          </label>
          <label>資訊類別
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as KnowledgeFilters["category"] }))}>
              <option value="">全部</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </fieldset>
        <div className="button-row">
          <button className="button primary" type="submit" disabled={state.status === "loading"}>套用篩選</button>
          <button className="button secondary" type="button" onClick={() => { setForm(initialKnowledgeFilters); setSubmitted(initialKnowledgeFilters); setPage(1); }}>清除條件</button>
        </div>
      </form>

      {state.status === "loading" && <p className="loading" role="status">正在取得已發布的長照資訊，請稍候。</p>}
      {state.status === "error" && (
        <section className="error" role="alert">
          <h2>{unavailable ? "目前沒有可用的已發布資訊" : "暫時無法取得資訊"}</h2>
          <p>{unavailable ? "目前沒有可用的已發布資訊，請稍後再試或聯絡 1966。" : errorMessage}</p>
          {!unavailable && <button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>再試一次</button>}
        </section>
      )}
      {state.status === "success" && (
        <>
          <section className="notice" aria-label="資訊使用提醒">
            <p>{state.response.notice}</p>
            <p className="knowledge-version">知識版本：{state.response.knowledgeVersion}</p>
          </section>
          {state.response.items.length === 0
            ? <section className="panel empty-state" role="status"><h2>目前沒有符合條件的資訊</h2><p>請調整篩選條件，或聯絡 1966 詢問。</p></section>
            : <div className="knowledge-list">{state.response.items.map((record) => <KnowledgeCard key={record.id} record={record} />)}</div>}
          <nav className="pagination" aria-label="長照資訊分頁">
            <button className="button secondary" type="button" disabled={state.response.page <= 1} onClick={() => setPage(previousKnowledgePage)}>上一頁</button>
            <span>第 {state.response.page} 頁，共 {Math.max(1, Math.ceil(state.response.totalCount / state.response.pageSize))} 頁</span>
            <button className="button secondary" type="button" disabled={state.response.page * state.response.pageSize >= state.response.totalCount} onClick={() => setPage((value) => value + 1)}>下一頁</button>
          </nav>
        </>
      )}

      <section className="panel knowledge-next-step">
        <h2>想了解自己的可能需求？</h2>
        <p>可以完成免費初步評估，或直接撥打 1966 與所在地長期照顧管理中心確認。</p>
        <Link className="button primary" to="/consent">開始免費長照評估</Link>
      </section>
    </main>
  );
}
