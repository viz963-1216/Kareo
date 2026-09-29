import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, isSessionProblem } from "../api";
import { DraftBadge } from "../components/DraftBadge";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import { SessionProblem } from "../components/SessionProblem";
import { useSession } from "../session/SessionContext";
import { useMockState } from "../session/useMockState";
import type { AssessmentLocation, AssessmentResponse, CareNeed } from "../types/api";

const labels: Record<CareNeed, string> = { HOME_CARE: "居家照顧", HOME_MEDICAL_NURSING: "居家醫療與護理", ASSISTIVE_DEVICE: "輔具", TRANSPORTATION: "長照交通" };
const KAREOCAR_URL = "https://kareocar.netlify.app/";

interface Props {
  result: AssessmentResponse | null;
  location: AssessmentLocation | null;
  onSessionClosed: (closure: SessionClosure) => void;
}

/**
 * API_CONTRACT v0.2.2 §8: `summary` is one string whose sentences are separated by "\n". Each line is shown
 * as its own paragraph exactly as received — the frontend never parses, computes or adds policy text.
 */
export function summaryLines(summary: string) {
  return summary.split("\n").map((line) => line.trim()).filter(Boolean);
}

function locationText(location: AssessmentLocation | null) {
  if (!location || location.precision === "NONE") return "未提供位置";
  if (location.precision === "CITY") return `${location.city}（未選行政區）`;
  return `${location.city}${location.district}${location.precision === "GPS" ? "，並提供目前位置" : ""}`;
}

export function ResultPage({ result, location, onSessionClosed }: Props) {
  if (!result) {
    return (
      <main id="main-content" className="content">
        <p className="eyebrow">尚無資料</p>
        <h1>尚未有初步結果</h1>
        <p>請先完成同意與評估，我們才能依目前資料整理可能需要的服務。</p>
        <Link className="button primary" to="/consent">開始評估</Link>
      </main>
    );
  }
  const profile = result.careNeedProfile;
  const noLocation = !location || location.precision === "NONE";
  const recommendable = profile.careNeeds.filter((need) => need !== "TRANSPORTATION");

  return (
    <main id="main-content" className="content">
      <p className="eyebrow">初步結果</p>
      <h1>依目前資料的初步預估</h1>
      <FormalAssessmentReminder />

      <section className="panel" aria-labelledby="summary-heading">
        <h2 id="summary-heading">初步評估說明與可能適用的制度、補助</h2>
        <div className="summary-lines">
          {summaryLines(profile.summary).map((line, index) => <p key={index}>{line}</p>)}
        </div>
        <p className="knowledge-version">資料版本：{result.knowledgeVersion}</p>
        <p className="field-hint">
          以上內容由平台依已發布的官方資料版本整理，金額與比率是官方規則與上限，不是您的核定結果。若沒有列出補助或地方資訊，代表平台目前沒有可引用的已發布資料，不代表您不符合，請洽 1966 確認。
        </p>
        <ul className="warnings">{profile.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        <FormalAssessmentReminder compact />
      </section>

      {profile.careNeeds.length ? (
        <>
          <section className="panel" aria-labelledby="needs-heading">
            <h2 id="needs-heading">可能需要的服務</h2>
            <p className="field-hint">位置：{locationText(location)}</p>
            <ul className="service-list">
              {profile.careNeeds.map((need) => (
                <li key={need}>
                  <span>{labels[need]}</span>
                  {need === "TRANSPORTATION"
                    ? <span className="field-hint">見下方 Kareocar 外部連結</span>
                    : !noLocation && <Link to={`/recommendations/${need}`}>查看服務單位</Link>}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel" aria-labelledby="priority-heading">
            <h2 id="priority-heading">建議優先處理順序</h2>
            <ol>{profile.priority.map((need) => <li key={need}>{labels[need]}</li>)}</ol>
          </section>
          {noLocation && recommendable.length > 0 && <NoLocationPanel />}
        </>
      ) : (
        <section className="panel empty-state" role="status">
          <h2>目前沒有明確服務建議</h2>
          <p>這不代表沒有長照需求。可返回補充照護狀況，或直接聯絡 1966 與所在地長照管理中心確認。</p>
          <Link className="button secondary" to="/assessment">返回修改評估</Link>
        </section>
      )}

      {profile.careNeeds.includes("TRANSPORTATION") && (
        <section className="panel">
          <h2>Kareocar 長照交通</h2>
          <p>如需長照交通資訊，可前往外部 Kareocar 平台。Kareocar 是外部服務，不在本平台內嵌或處理預約。</p>
          <a className="button secondary" href={KAREOCAR_URL} target="_blank" rel="noopener noreferrer">前往 Kareocar（開啟新分頁）</a>
        </section>
      )}

      <DataControls onClosed={onSessionClosed} />
    </main>
  );
}

// PRODUCT_SPEC §24 / D-13b: without a location no provider is recommended and no "nearby" wording is used.
export function NoLocationPanel() {
  return (
    <section className="panel no-location" aria-labelledby="no-location-heading">
      <h2 id="no-location-heading">提供縣市或行政區，才能推薦服務單位</h2>
      <p>您尚未提供位置，因此目前只顯示需求與服務建議，不推薦特定服務單位。補充縣市或行政區後，可以取得服務範圍相符的推薦。</p>
      <Link className="button secondary" to="/assessment" state={{ focus: "location" }}>補充位置並重新評估</Link>
    </section>
  );
}

export type SessionClosure =
  | { kind: "deleted"; deletionScheduledBefore: string }
  | { kind: "withdrawn"; withdrawnAt: string };

const closeActions = {
  delete: {
    label: "刪除我的評估資料",
    busy: "正在送出刪除要求…",
    confirm: "確定要刪除？送出後這次的評估、推薦與媒合需求都無法再查看，已送出的媒合需求也會取消。",
    notDone: "資料尚未刪除。",
  },
  withdraw: {
    label: "撤回同意",
    busy: "正在送出撤回…",
    confirm: "確定要撤回同意？撤回後這個使用階段無法再評估或送出媒合，資料會進入刪除流程，已送出的媒合需求也會取消。",
    notDone: "同意尚未撤回。",
  },
} as const;

function DataControls({ onClosed }: { onClosed: (closure: SessionClosure) => void }) {
  const { restart } = useSession();
  const mockState = useMockState();
  const [action, setAction] = useState<keyof typeof closeActions | null>(null);
  const [status, setStatus] = useState<"idle" | "confirm" | "loading" | "error">("idle");
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);

  async function run() {
    if (busy.current || !action) return;
    busy.current = true;
    setStatus("loading");
    try {
      if (action === "delete") {
        const deletion = await api.deleteSession(mockState);
        onClosed({ kind: "deleted", deletionScheduledBefore: deletion.deletionScheduledBefore });
      } else {
        const withdrawal = await api.withdrawConsent(mockState);
        onClosed({ kind: "withdrawn", withdrawnAt: withdrawal.withdrawnAt });
      }
    } catch (reason) {
      setError(reason);
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }

  const copy = action ? closeActions[action] : null;
  const message = error instanceof Error ? error.message : "要求暫時無法送出，請稍後再試。";
  return (
    <section className="panel" aria-labelledby="data-heading">
      <h2 id="data-heading">您的資料 <DraftBadge>依隱私告知草案</DraftBadge></h2>
      <p>「重新開始」只清除這個瀏覽器分頁上的畫面資料，<strong>不會刪除</strong>已送到平台的評估資料。如需刪除，請使用「刪除我的評估資料」或「撤回同意」。</p>
      <div className="button-row">
        <button type="button" className="button secondary" onClick={() => restart()}>重新開始</button>
        {(Object.keys(closeActions) as (keyof typeof closeActions)[]).map((key) => (
          <button
            key={key}
            type="button"
            className="button secondary"
            disabled={status === "loading"}
            aria-expanded={status === "confirm" && action === key}
            onClick={() => { setAction(key); setStatus("confirm"); }}
          >
            {status === "loading" && action === key ? closeActions[key].busy : closeActions[key].label}
          </button>
        ))}
      </div>
      {status === "confirm" && copy && (
        <div className="confirm-box" role="group" aria-labelledby="confirm-close-text">
          <p id="confirm-close-text">{copy.confirm}</p>
          <div className="button-row">
            <button type="button" className="button primary" onClick={run}>確定{copy.label}</button>
            <button type="button" className="button secondary" onClick={() => setStatus("idle")}>取消</button>
          </div>
        </div>
      )}
      {status === "loading" && <p className="loading" role="status">正在送出要求，請稍候。</p>}
      {status === "error" && copy && (isSessionProblem(error)
        ? <SessionProblem message={message} />
        : <p className="error" role="alert">{message} {copy.notDone}</p>)}
    </section>
  );
}
