import { Link, useSearchParams } from "react-router-dom";
import { consentArchive, consentArchives } from "../api";
import { ConsentDocument } from "../consent/ConsentDocument";
import { demoMode } from "../demo";

export function PrivacyPage() {
  const [parameters] = useSearchParams();
  if (demoMode) return <main id="main-content" className="content"><p className="eyebrow">專題展示</p><h1>展示版資料說明</h1>
    <section className="panel"><h2>只使用虛構個案</h2><p>此站使用瀏覽器內的示範資料，呈現 Kareo 的操作流程。評估回答與測試媒合僅保留在本頁記憶體，不送至 Kareo API、Supabase、真人客服或機構；重新整理即可重設。</p>
    <p>請勿填寫真實健康或身分資料。聯絡欄位固定使用測試值，真實定位與管理登入已停用。推薦與補助內容為示範，不是個人資格核定或已建立的案件。</p>
    <h2>網站與外部服務</h2><p>Netlify 提供靜態網站，仍可能處理正常的網路連線與安全日誌。Google Maps、官方來源及 Kareocar 連結會開啟外部服務；連結不附帶評估回答或聯絡資料，請不要在外部服務提交展示個案。</p>
    <h2>聯絡</h2><p>展示站負責人：蘇子傑（Kareo）。問題或資料權利申請：<a href="mailto:viz963@gmail.com">viz963@gmail.com</a>。</p></section><p><Link to="/">返回首頁</Link></p>
  </main>;
  const requestedVersion = parameters.get("version");
  const archive = requestedVersion ? consentArchives.find(entry => entry.version === requestedVersion) : consentArchive;
  if (archive) return <ConsentDocument key={archive.version} archive={archive} />;
  if (requestedVersion) return <main id="main-content" className="content"><h1>找不到指定的服務說明版本</h1><p role="alert">此版本不在可查閱的正式文件清單內。</p><p><Link to="/privacy">返回隱私告知</Link></p></main>;
  return <main id="main-content" className="content">
    <p className="eyebrow">隱私與資料使用</p>
    <h1>Kareo 隱私告知</h1>
    <p className="notice">草案版本：2026-10-03-r2-draft。正式評估與媒合尚未開放；以下是預定資料處理方式，保存、撤回與刪除流程須完成驗證後才能啟用。</p>
    <p><a href="/privacy/versions/2026-10-05-r1-proposed.txt" download>下載審閱用候選文案全文（2026-10-05-r1，尚未生效）</a>。這份候選文案不取代目前的草案或啟用正式資料蒐集。</p>
    <section className="panel">
      <h2>誰負責資料與聯絡方式</h2>
      <p>資料蒐集者／營運者：蘇子傑（Kareo）。客服與個人資料權利申請：<a href="mailto:viz963@gmail.com">viz963@gmail.com</a>。</p>
      <h2>收集哪些資料、用來做什麼</h2>
      <p>公開資源與制度資訊查詢不要求填寫健康資料或聯絡資料。網站主機仍可能為連線與安全處理網路資訊；不將查詢關鍵字保存到業務紀錄。</p>
      <p>初評預定收集年齡區間、日常活動與照護需求、居住與照顧者狀況，用來產生初步需求與補助資訊。行政區、身障證明是否題、經濟身分、自由文字及目前位置為選填；不收身分證字號、完整病歷、診斷證明或證明文件。</p>
      <p>只有主動提出媒合並另外同意聯絡時，才收集稱呼、電話與所選服務，用於接件及聯繫。資料不作廣告行銷、不販售，也不交給 AI 服務分析。</p>
      <h2>可以不提供嗎</h2>
      <p>不做評估仍可使用已開放的公開資訊。選填資料可略過，可能減少結果細節；不提供位置仍可取得服務建議，但不能產生所在地或距離推薦。不提供媒合聯絡資料則無法由客服聯繫，不影響其他資訊查詢。</p>
      <p>如果替家人填寫，請先確認已取得當事人的同意或其他合法授權；不要貼上與本次需求無關的病歷或其他人的資料。</p>
      <h2>誰能使用資料、在哪裡處理</h2>
      <p>資料由 Kareo 維運者及被指派的接件人，在必要權限範圍內使用。網站與 API 委託 Netlify，資料庫委託 Supabase 處理；Netlify Functions 在美國北維吉尼亞，Supabase Kareo 主資料庫在日本東京。CDN、日誌、備份與支援處理的範圍及保存設定仍待核對，完成前不啟用正式收集。</p>
      <p>不會自動把資料提供給機構。若媒合需轉告資料，接件人須先告知對象、資料及用途，取得同意並留下紀錄後，才轉告必要資訊。</p>
      <h2>保存與刪除</h2>
      <p>預定：評估資料在最後使用後 90 天刪除；媒合聯絡資料在結案或取消後 180 天刪除；案件狀態保留 1 年；同意證據保留 3 年。這些是平台規劃，並非法律統一規定的期限；須完成必要性確認與清理驗證。</p>
      <p>預定支援撤回同意與結果頁刪除。備份可能依備份週期自然汰換；備份期限與還原後再次刪除流程仍待驗證，不能承諾立即從所有副本消失。</p>
      <h2>你的權利與申請方式</h2>
      <p>你可以申請查詢或閱覽、複製、更正、停止蒐集處理或利用，以及刪除資料。請寄信到 <a href="mailto:viz963@gmail.com">viz963@gmail.com</a>，說明要行使的權利與必要案件識別資訊。請勿寄送 Session token、身分證影本或完整病歷；我們會以必要且最少的方式確認身分。</p>
      <p>查詢／閱覽／複製申請，依法於 15 日內決定，必要時可延長不超過 15 日並書面告知原因；更正、停止及刪除相關申請，依法於 30 日內決定，必要時可延長不超過 30 日並書面告知原因。受理與實際處理方式仍須完成內部演練。</p>
      <h2>安全、外部連結與更新</h2>
      <p>預定以 HTTPS、後端權限、token 雜湊及存取紀錄保護資料；不在業務日誌記錄健康回答、電話或 token。主機服務的存取日誌需另行控管，不能把 token 雜湊視為完全匿名。</p>
      <p>Google Maps 與 Kareocar 以外部連結開啟，各自適用其政策；Kareo 不會透過連結附帶評估回答、電話或 token。使用電子郵件聯絡時，也會經過電子郵件服務商。</p>
      <p>重要用途或文案更新會建立新版本，在需要時重新取得同意，不以繼續瀏覽取代必要的明確同意。</p>
    </section>
    <p><Link to="/">返回首頁</Link></p>
  </main>;
}
