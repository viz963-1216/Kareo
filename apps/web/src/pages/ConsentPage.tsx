import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiMode, consentArchive, consentIsDraft, consentVersions, getConsentDocument } from "../api";
import { DraftBadge } from "../components/DraftBadge";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import { demoEntryUrl, demoMode } from "../demo";

interface Props {
  onAccept: () => Promise<void>;
}

// Draft summaries never authorize real collection. Formal consent uses the exact archived text.
export function ConsentPage({ onAccept }: Props) {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const [documentReady, setDocumentReady] = useState(apiMode === "mock");
  const [documentError, setDocumentError] = useState("");
  const formalConsentUnavailable = apiMode === "real" && !consentArchive;

  useEffect(() => {
    if (formalConsentUnavailable && demoEntryUrl) window.location.replace(demoEntryUrl);
  }, [formalConsentUnavailable]);

  useEffect(() => {
    if (apiMode === "mock" || !consentArchive) return;
    let cancelled = false;
    getConsentDocument().then(() => { if (!cancelled) setDocumentReady(true); })
      .catch(() => { if (!cancelled) setDocumentError("無法載入完整服務說明，暫時無法開始評估。請重新載入頁面或查詢公開資訊。"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status === "error") errorRef.current?.focus();
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (formalConsentUnavailable || !accepted || !documentReady || status === "loading") return;
    setStatus("loading"); setError("");
    try { await onAccept(); navigate("/assessment"); }
    catch (reason) { setStatus("error"); setError(reason instanceof Error ? reason.message : "目前無法完成同意程序，請稍後再試。"); }
  }

  if (demoMode) return <main id="main-content" className="content">
    <p className="eyebrow">Demo・本機需求分析</p><h1>依需求查詢真實長照資源</h1>
    <section className="panel"><h2>依你填寫的條件產生結果</h2>
      <p>初步結果使用 Kareo 的固定規則與已發布知識，機構使用已核對的雙北名單，依需求與行政區比對。回答僅在本分頁記憶體中處理，不送至資料庫。</p>
      <p>此版本不要求姓名、電話、自由文字或 GPS，也不建立正式媒合案件。<Link to="/privacy">查看資料使用說明</Link>。</p>
    </section>
    <form className="stack" onSubmit={handleSubmit} aria-busy={status === "loading"}>
      <label className="checkbox"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={status === "loading"}/><span>我了解回答只用於本機需求分析，不會建立正式案件。</span></label>
      {status === "error" && <div ref={errorRef} tabIndex={-1} role="alert" className="error">{error}</div>}
      <button className="button primary" disabled={!accepted || status === "loading"}>{status === "loading" ? "正在開始…" : "開始需求分析"}</button>
    </form>
  </main>;

  if (formalConsentUnavailable && demoEntryUrl) return <main id="main-content" className="content">
    <h1>開啟 Demo 需求分析</h1><p>正在開啟可操作的展示流程，回答只在瀏覽器內處理。</p>
    <a className="button primary" href={demoEntryUrl}>開始 Demo 需求分析</a>
  </main>;

  return (
    <main id="main-content" className="content">
      <p className="eyebrow">開始前確認</p>
      <h1>服務說明與同意</h1>
      {consentIsDraft && <p><DraftBadge>草案版本・正式啟用驗證尚未完成</DraftBadge></p>}
      <FormalAssessmentReminder />
      {consentArchive && <section className="panel" aria-label="本次同意文件">
        <h2>本次服務說明</h2>
        <p>請先<Link to={`/privacy?version=${consentArchive.version}`}>閱讀本版完整免責聲明、隱私告知與服務條款</Link>，也可<a href={consentArchive.fullTextUrl} download>下載保存全文</a>。</p>
        <p className="field-hint">免責聲明 {consentArchive.disclaimerVersion}、隱私告知 {consentArchive.privacyVersion}、服務條款 {consentArchive.termsVersion}</p>
        {!documentReady && !documentError && <p role="status">正在載入本版完整服務說明…</p>}
        {documentError && <p className="error" role="alert">{documentError}</p>}
      </section>}
      {consentIsDraft && <>
      <section className="panel" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading">免責聲明</h2>
        <p>
          Kareo 提供的是依您填寫資料所做的<strong>初步預估</strong>與資訊整理，不是政府正式的長照資格、長照需要等級（CMS）或補助核定，也不是醫療診斷。實際資格、等級、服務內容與補助，請以長照專線 <strong>1966</strong> 或所在地長期照顧管理中心的正式評估為準。
        </p>
        <h2 id="privacy-heading">隱私告知（重點）</h2>
        <p><Link to="/privacy">閱讀完整隱私告知、權利申請與保存說明</Link></p>
        <ul>
          <li>評估不需要提供姓名或電話。</li>
          <li>您的評估回答（包含行動能力、日常生活協助等與健康相關的資訊）只會由 Kareo 系統依固定規則產生初步結果，不會交給 AI 服務分析；網站與資料庫由 Netlify、Supabase 受委託處理。</li>
          <li>只有在您按下「我要媒合」並勾選同意後，我們才會保存您的稱呼與電話，由 Kareo 服務人員聯繫您。未經您同意，不會把您的資料交給服務單位。</li>
          <li>預定保存期限：評估資料在最後使用後 90 天刪除；媒合聯絡資料在案件結束後 180 天刪除。到期清理、結果頁刪除與撤回同意須完成驗證後才正式開放；也可以來信 <a href="mailto:viz963@gmail.com">viz963@gmail.com</a> 要求刪除。</li>
        </ul>
        {consentVersions && (
          <p className="field-hint">
            文件版本：免責聲明 {consentVersions.disclaimerVersion}、隱私告知 {consentVersions.privacyVersion}、服務條款 {consentVersions.termsVersion}
          </p>
        )}
      </section>
      <p>全程免費，不需登入。位置為選填，不提供也能完成評估。</p>
      </>}
      <form onSubmit={handleSubmit} className="stack" aria-busy={status === "loading"}>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            disabled={(!formalConsentUnavailable && !documentReady) || status === "loading"}
            aria-describedby={formalConsentUnavailable ? "consent-unavailable" : undefined}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>{formalConsentUnavailable ? "我已閱讀上述服務說明、免責聲明與隱私告知（僅閱讀確認，尚未送出正式同意）。" : consentArchive?.assessmentConsentText ?? "我已閱讀並同意上述服務說明、免責聲明與隱私告知。"}</span>
        </label>
        {formalConsentUnavailable && <p id="consent-unavailable" className="notice" role="status">您可以勾選閱讀確認；此操作只保留在本頁，不會建立使用階段或保存同意紀錄。正式同意版本尚未啟用，因此目前無法開始評估。您仍可<Link to="/resources">查詢長照資源</Link>或<Link to="/info">查詢長照制度資訊</Link>。</p>}
        {status === "loading" && <p className="loading" role="status">正在建立使用階段並記錄您的同意，請稍候。</p>}
        {status === "error" && <div className="error" role="alert" ref={errorRef} tabIndex={-1}><h2>同意程序尚未完成</h2><p>{error}</p></div>}
        <button className="button primary" disabled={formalConsentUnavailable || !documentReady || !accepted || status === "loading"} aria-describedby={formalConsentUnavailable ? "consent-unavailable" : undefined}>
          {formalConsentUnavailable ? "正式評估尚未開放" : status === "loading" ? "處理中…" : "同意並開始評估"}
        </button>
      </form>
    </main>
  );
}
