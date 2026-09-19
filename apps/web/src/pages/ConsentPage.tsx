import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  onAccept: () => Promise<void>;
}

export function ConsentPage({ onAccept }: Props) {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) return;
    setStatus("loading"); setError("");
    try { await onAccept(); navigate("/assessment"); }
    catch (reason) { setStatus("error"); setError(reason instanceof Error ? reason.message : "目前無法完成同意程序，請稍後再試。"); }
  }

  return (
    <main id="main-content" className="content">
      <p className="eyebrow">開始前確認</p>
      <h1>服務說明與同意</h1>
      <p className="mock-badge" role="status">MVP MOCK 文案・尚待 J-002 核准正式版本</p>
      <section className="panel" aria-labelledby="service-description-heading">
        <h2 id="service-description-heading">本服務提供什麼？</h2>
        <p>Kareo 協助整理長照需求與服務方向，結果僅供初步參考，不代表政府或醫療單位的正式認定。</p>
        <h2>免責聲明</h2>
        <p>本平台不提供疾病診斷、治療決策、正式長照資格、CMS 等級或補助核定。</p>
        <h2>隱私提醒</h2>
        <p>目前為 MVP Mock 文案，正式隱私告知與版本將依 J-002 核准內容更新。請勿在自由描述欄位填入不必要的身分證、完整病歷或金融資料。</p>
      </section>
      <form onSubmit={handleSubmit} className="stack">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>我已閱讀並同意上述服務說明、免責聲明與目前標示為 Mock 的隱私告知。</span>
        </label>
        {status === "error" && <p className="error" role="alert">{error}</p>}
        <button className="button primary" disabled={!accepted || status === "loading"}>
          {status === "loading" ? "處理中…" : "同意並開始評估"}
        </button>
      </form>
    </main>
  );
}
