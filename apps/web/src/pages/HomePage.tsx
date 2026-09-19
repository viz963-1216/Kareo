import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main id="main-content" className="hero">
      <p className="eyebrow">Kareo 長照一點通</p>
      <h1>先釐清需求，再找到適合的下一步。</h1>
      <p className="lead">用幾分鐘完成免費初步評估，了解可能需要的長照服務與可採取的行動。</p>
      <Link className="button primary" to="/consent">開始免費長照評估</Link>
      <p className="supporting-text">全程免費，不需登入；約 3–5 分鐘完成。</p>
      <section className="notice" aria-label="重要提醒">
        <h2>這是初步預估，不是正式核定</h2>
        <p>實際資格、長照等級、服務內容及補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。</p>
      </section>
    </main>
  );
}
