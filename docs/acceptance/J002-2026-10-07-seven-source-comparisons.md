# J-002：2026-10-07 新增七筆官方來源差異核對

Submission Version: J-002-r16

本輪核對 [crawler 實際執行 37571162928](https://github.com/viz963-1216/Kareo/actions/runs/37571162928) 新增的七筆 NEEDS_REVIEW。它們比較的是資料庫原先保存的人工選取段落與爬蟲本次擷取的整頁文字，並不是兩份相同範圍的全文。

| 來源 | Change ID | 原段落／新整頁字數 | 原有非空行／缺少行 | 判斷 |
| --- | --- | --- | --- | --- |
| [可申請長照服務的資格](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059)（SRC-LAW-L0070059） | KCHG-MUXLQRO3A8XSZQ5D | 230／5089 | 7／0 | 原選取文字仍在新整頁中 |
| [臺北市長期照顧管理中心聯絡資訊](https://health.gov.taipei/News_Content.aspx?n=4244BB51FC46A03C&sms=72730260368A9FA4&s=718465B2053B7E77)（SRC-TPE-HEALTH-LTC-APPLY） | KCHG-MUXLR5HDLEY0BYAC | 57／3420 | 1／0 | 原選取文字仍在新整頁中 |
| [臺北市喘息服務的三種方式](https://health.gov.taipei/News_Content.aspx?n=4F01EBDF8F61F315&sms=72544237BBE4C5F6&s=B50D5370D99E02DC)（SRC-TPE-HEALTH-RESPITE-NEWS） | KCHG-MUXLRMBY30FB1ZKI | 725／4575 | 7／0 | 原選取文字仍在新整頁中 |
| [臺北市長照交通接送服務使用規則](https://dosw.gov.taipei/cp.aspx?n=1847C5A001C1DC3C)（SRC-TPE-DOSW-LTC-TRANSPORT） | KCHG-MUXLRPA1KGZAC57L | 943／3597 | 26／0 | 原選取文字仍在新整頁中 |
| [臺北市申請長照服務的管道](https://dosw.gov.taipei/cp.aspx?n=F07637F92E4E85A0)（SRC-TPE-DOSW-HOME-CARE） | KCHG-MUXLRQHGOHQMRNK1 | 140／2724 | 3／0 | 原選取文字仍在新整頁中 |
| [新北市申請長照服務的管道](https://service.ntpc.gov.tw/eservice/CaseData.action?itemId=124014)（SRC-NTPC-ESERVICE-LTC） | KCHG-MUXLRSP6A67459JM | 693／1316 | 21／0 | 原選取文字仍在新整頁中 |
| [新北市長照輔具及居家無障礙補助申請流程](https://service.ntpc.gov.tw/eservice/CaseData.action?itemId=110105)（SRC-NTPC-ESERVICE-AD） | KCHG-MUXLSANO6XJT6CGR | 901／1896 | 23／0 | 原選取文字仍在新整頁中 |

## 方法與結果界線

2026-10-07 唯讀取回 acceptance DB 的 old_content／new_content，逐行比對；採用 Unicode NFKC、移除空白、臺／台等價及 HTML `&times;` → `×` 解碼。也開啟上表七個官方來源核對對應內容。七筆既有段落的非空行全部仍可找到；交通頁的乘號顯示差異是 HTML entity，不是調整為另一個費率。

這個結果只證明既有選取內容仍存在。它不證明整部法規、整頁其他條件、附件、實施日期或未收錄段落完全沒變，也不代表自動批准新全文。各來源新增導覽、頁尾、訪客數及整頁其他內容，造成不同 SHA-256；現行 html-strip-v1 尚未按人工選取段落擷取。

本輪沒有在雲端 dismiss、核准或發布這七筆，資料庫觀察值仍為 NEEDS_REVIEW。正式處理須透過受保護的管理審核服務，寫入原因與操作者稽核；不得用原段落包含測試直接自動忽略任何新條件，也不得用原始 SQL 改成已審核。若接續判定為擷取範圍造成差異，可引用本報告，記錄「既有段落無實質變更」的限定原因，不宣稱整頁政策未變。

機器可查證的逐筆 ID、時間、舊／新雜湊及行數見 [七筆比對證據](evidence/J002-2026-10-07-seven-source-comparisons.json)。來源文字維持公開查詢與已發布知識原狀，不整頁覆蓋摘要、ruleData 或既有發布版本。

