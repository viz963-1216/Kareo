import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { retrieveConsentDocument, type ConsentArchive } from "./documents";

export function ConsentDocument({ archive }: { archive: ConsentArchive }) {
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setText(""); setFailed(false);
    retrieveConsentDocument(archive).then(value => { if (!cancelled) setText(value); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [archive]);
  return <main id="main-content" className="content">
    <h1>Kareo 服務說明與隱私告知</h1>
    <p>文件版本：{archive.version}。{archive.active ? "此版本列於正式同意清單。" : "此為歷史版本，不代表目前可用於建立新的同意。"}</p>
    {!text && !failed && <p role="status">正在載入完整文件…</p>}
    {failed && <p className="error" role="alert">無法載入完整文件。請重新載入頁面；文件未完整載入前，無法進行正式評估。</p>}
    {text && <>
      <p><a href={archive.fullTextUrl} download>下載保存本版全文</a>　<button type="button" className="button secondary" onClick={() => window.print()}>列印本版全文</button></p>
      <pre className="panel" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit" }}>{text}</pre>
    </>}
    <p><Link to="/consent">返回服務說明與同意</Link>　<Link to="/resources">查詢公開資源</Link></p>
  </main>;
}
