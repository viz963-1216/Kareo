import { Link } from "react-router-dom";
import type { AssessmentResponse, CareNeed } from "../types/api";

const labels: Record<CareNeed, string> = { HOME_CARE: "居家照顧", HOME_MEDICAL_NURSING: "居家醫療與護理", ASSISTIVE_DEVICE: "輔具", TRANSPORTATION: "長照交通" };
export function ResultPage({ result }: { result: AssessmentResponse | null }) {
  if (!result) return <main id="main-content" className="content"><p className="eyebrow">尚無資料</p><h1>尚未有初步結果</h1><p>請先完成同意與評估，我們才能依目前資料整理可能需要的服務。</p><Link className="button primary" to="/consent">開始評估</Link></main>;
  const profile = result.careNeedProfile;
  return <main id="main-content" className="content"><p className="eyebrow">初步結果</p><h1>依目前資料的初步預估</h1><section className="notice"><p>{profile.summary}</p><ul>{profile.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>
    {profile.careNeeds.length ? <><section className="panel"><h2>可能需要的服務</h2><ul className="service-list">{profile.careNeeds.map((need) => <li key={need}><span>{labels[need]}</span>{need !== "TRANSPORTATION" && <Link to={`/recommendations/${need}`}>查看服務單位</Link>}</li>)}</ul></section><section className="panel"><h2>建議優先處理順序</h2><ol>{profile.priority.map((need) => <li key={need}>{labels[need]}</li>)}</ol></section></> : <section className="panel empty-state" role="status"><h2>目前沒有明確服務建議</h2><p>這不代表沒有長照需求。可返回補充照護狀況，或直接聯絡 1966 與所在地長照管理中心確認。</p><Link className="button secondary" to="/assessment">返回修改評估</Link></section>}
    {profile.careNeeds.includes("TRANSPORTATION") && <section className="panel"><h2>Kareocar 長照交通</h2><p>如需長照交通資訊，可前往外部 Kareocar 平台。</p><a className="button secondary" href="https://kareocar.netlify.app/" target="_blank" rel="noreferrer">前往 Kareocar（開啟新分頁）</a></section>}
    <p className="footer-reminder">實際資格、長照等級、服務內容及補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。</p></main>;
}
