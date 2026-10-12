import { Link } from "react-router-dom";
import { KAREOCAR_URL } from "../externalServices";
import { demoEntryUrl, localAnalysisMode } from "../demo";

export function HomePage() {
  return (
    <main id="main-content" className="hero home-page">
      <section className="home-intro" aria-labelledby="home-title">
        <p className="eyebrow">Kareo 長照一點通・一站式長照資訊整合</p>
        <h1 id="home-title">先整理長照需求，了解下一步</h1>
        <p className="lead">想替自己或家人先了解長照？從生活狀況整理可能需要的服務、制度與補助資訊，為和個管師或 1966 討論做好準備。</p>
        {demoEntryUrl ? <a className="button primary" href={demoEntryUrl}>開始免費長照評估</a> : <Link className="button primary" to="/consent">開始免費長照評估</Link>}
        <p className="supporting-text">免費｜不需登入｜兩步簡短填答</p>
        {localAnalysisMode && <p className="field-hint">回答與選填住址只保留在本分頁，重新整理即清除。</p>}
      </section>

      <section className="home-process" aria-labelledby="process-heading">
        <h2 id="process-heading">完成後，知道可以怎麼做</h2>
        <ol className="process-grid">
          <li><span className="step-number" aria-hidden="true">1</span><h3>回答生活狀況</h3><p>填寫照護情況與可能需要的服務；位置可選填，不確定的題目也能繼續。</p></li>
          <li><span className="step-number" aria-hidden="true">2</span><h3>看初步資訊整理</h3><p>了解服務建議與制度說明；提供位置後，可查詢符合條件的同區單位。</p></li>
          <li><span className="step-number" aria-hidden="true">3</span><h3>準備和個管師討論</h3><p>將重點整理成可列印或複製的需求摘要，再向 1966 或照管中心確認。</p></li>
        </ol>
        <aside className="result-example" aria-labelledby="example-heading">
          <p className="eyebrow">結果示意・不是您的評估</p>
          <h3 id="example-heading">把「不知道從哪開始」整理成可討論的重點</h3>
          <ul><li>可能需要的服務：例如居家照顧、輔具。</li><li>下一步：向個管師確認申請方式與適合的服務。</li><li>帶去討論：列印或複製本次需求摘要。</li></ul>
          <p className="field-hint">實際內容會依填答及可引用資料產生；這裡不顯示個人核定金額。</p>
        </aside>
      </section>

      <section className="home-secondary-actions" aria-labelledby="other-options-heading">
        <h2 id="other-options-heading">也可以先查資訊</h2>
        <p>不需先做評估，即可查詢雙北的居家照顧、居家醫療與護理、輔具商家及資源中心，或查看目前可用的制度與補助資訊。</p>
        <div className="button-row">
          <Link className="button secondary" to="/info">查看長照制度與補助</Link>
          <Link className="button secondary" to="/resources">查詢長照資源</Link>
          <a className="button secondary" href={KAREOCAR_URL} target="_blank" rel="noopener noreferrer">長照交通預約（Kareocar）<span className="external-label">外部服務・開啟新分頁</span></a>
        </div>
      </section>
      <section className="notice" aria-labelledby="boundary-heading">
        <h2 id="boundary-heading">初步參考，正式資格仍需確認</h2>
        <p>Kareo 協助整理資訊，不提供醫療診斷，也不代表長照資格、等級或補助已經核定。實際服務與補助，仍應由 <a href="tel:1966" aria-label="撥打長照專線 1966">1966</a> 或所在地長期照顧管理中心正式評估確認。</p>
        <Link to="/privacy">查看資料使用與隱私說明</Link>
      </section>
    </main>
  );
}
