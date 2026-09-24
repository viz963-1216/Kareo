import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { consentIsDraft, consentVersions } from "../api";
import { DraftBadge } from "../components/DraftBadge";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";

interface Props {
  onAccept: () => Promise<void>;
}

// Copy follows PRIVACY_AND_RETENTION §8 (DRAFT, version 2026-10-01-r1-draft). The versions actually submitted
// come from deployment settings (src/api/index.ts); this page never claims the copy is approved.
export function ConsentPage({ onAccept }: Props) {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accepted || status === "loading") return;
    setStatus("loading"); setError("");
    try { await onAccept(); navigate("/assessment"); }
    catch (reason) { setStatus("error"); setError(reason instanceof Error ? reason.message : "目前無法完成同意程序，請稍後再試。"); }
  }

  return (
    <main id="main-content" className="content">
      <p className="eyebrow">開始前確認</p>
      <h1>服務說明與同意</h1>
      {consentIsDraft && <p><DraftBadge>草案文案・尚未經法務確認，非正式核准版本</DraftBadge></p>}
      <FormalAssessmentReminder />
      <section className="panel" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading">免責聲明</h2>
        <p>
          Kareo 提供的是依您填寫資料所做的<strong>初步預估</strong>與資訊整理，不是政府正式的長照資格、長照需要等級（CMS）或補助核定，也不是醫療診斷。實際資格、等級、服務內容與補助，請以長照專線 <strong>1966</strong> 或所在地長期照顧管理中心的正式評估為準。
        </p>
        <h2 id="privacy-heading">隱私告知（重點）</h2>
        <ul>
          <li>評估不需要提供姓名或電話。</li>
          <li>您的評估回答（包含行動能力、日常生活協助等與健康相關的資訊）只會由 Kareo 系統依固定規則產生初步結果，不會提供給其他公司或 AI 服務。</li>
          <li>只有在您按下「我要媒合」並勾選同意後，我們才會保存您的稱呼與電話，由 Kareo 服務人員聯繫您。未經您同意，不會把您的資料交給服務單位。</li>
          <li>評估資料在最後使用後 90 天刪除；媒合聯絡資料在案件結束後 180 天刪除。您可以隨時在結果頁刪除資料或撤回同意，也可以來信（客服信箱待公布）要求刪除。</li>
        </ul>
        {consentVersions && (
          <p className="field-hint">
            文件版本：免責聲明 {consentVersions.disclaimerVersion}、隱私告知 {consentVersions.privacyVersion}、服務條款 {consentVersions.termsVersion}
          </p>
        )}
      </section>
      <p>全程免費，不需登入。位置為選填，不提供也能完成評估。</p>
      <form onSubmit={handleSubmit} className="stack">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>我已閱讀並同意上述服務說明、免責聲明與隱私告知。</span>
        </label>
        {status === "error" && <p className="error" role="alert">{error}</p>}
        <button className="button primary" disabled={!accepted || status === "loading"}>
          {status === "loading" ? "處理中…" : "同意並開始評估"}
        </button>
      </form>
    </main>
  );
}
