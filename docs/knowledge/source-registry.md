# Knowledge Source Registry / 官方知識來源登錄

Submission Version: J-002-r1
Owner: Jerry
Registry version: SR-2026-09-23-01
Status: **SPEC-APPROVED 2026-09-24**（MVP_DECISIONS D-02a，[PR #31 comment](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806704685)）；新北市來源 FETCH_FAILED 待補

本登錄是 B-008 的正式輸入。只有列在這裡、`active = true` 的來源可以產生 `KnowledgeRecord`。
白名單範圍依 ARCHITECTURE §9：衛生福利部、1966／長照專區、全國法規資料庫、臺北市政府、新北市政府。

擷取方式：2026-09-23 由 J-002 直接下載官方頁面原文／附件 PDF，逐字擷取條文或表格；**不使用第三方整理或 AI 摘要作為來源**。
雜湊值為擷取當下原始檔（HTML 或 PDF）的 SHA-256，用來判斷來源日後是否變動。
注意（2026-09-24 複查）：全國法規資料庫 HTML 頁含瀏覽人次等動態內容，原始檔 SHA-256 每次不同，但條文未變；PDF 附表的 SHA-256 則穩定。每日比對（B-009）應以條文正文或 PDF 為準，不以整頁 HTML 判斷變更。

---

## Sources

| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本／日期資訊 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| `SRC-LAW-L0070059` | 長期照顧服務申請及給付辦法（條文） | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059 | 修正日期 2025-06-19（民國 114 年）；2025-10-03 衛部顧字第 1141962704 號函勘誤 | OK，HTML sha256 `7dab8e85…0b1b` | true |
| `SRC-LAW-L0070059-T2` | 同上 附表二 長照需要等級及長照服務給付項目之額度 | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000398330&lan=C | 隨上列修正 | OK，PDF sha256 `981cac6d…e999c` | true |
| `SRC-LAW-L0070059-T3` | 同上 附表三 交通接送服務給付分區表 | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000398334&lan=C | 隨上列修正（勘誤涉及本表） | OK，PDF sha256 `63ab4838…a42a1` | true |
| `SRC-LAW-L0070059-T5` | 同上 附表五 部分負擔比率 | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000398333&lan=C | 隨上列修正（勘誤涉及本表） | OK，PDF sha256 `43817b11…b717576` | true |
| `SRC-MOHW-1966-APPLY` | 衛福部長照專區「申請長照服務」 | `MOHW` | `TAIWAN` | https://1966.gov.tw/LTC/cp-6533-70777-207.html | 頁面未標示更新日期 | OK，文字 sha256 `6efb5c5c…d50` | true |
| `SRC-TPE-HEALTH-LTC-APPLY` | 臺北市政府衛生局「如何申請長照服務」 | `TAIPEI_GOV` | `TAIPEI` | https://health.gov.taipei/News_Content.aspx?n=4244BB51FC46A03C&sms=72730260368A9FA4&s=718465B2053B7E77 | 資料更新 115-09-04 | OK，文字 sha256 `65c58611…545d` | true |
| `SRC-LAW-L0070040` | 長期照顧服務法 | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070040 | 尚未擷取原文 | 未擷取（首批不產生紀錄） | true |
| `SRC-NTPC-HEALTH-LTC` | 新北市政府衛生局 長期照顧相關頁面 | `NEW_TAIPEI_GOV` | `NEW_TAIPEI` | https://www.health.ntpc.gov.tw/basic/?node=10081 | — | **FETCH_FAILED**（2026-09-23 程式擷取回傳空內容） | true |

完整雜湊值見 `contracts/knowledge/packs/KP-2026-09-23-001.json` 各紀錄的 `source.contentHash`。

---

## 已知缺口（不得以非官方資料補齊）

1. **新北市照管中心聯絡方式**：官方頁面程式擷取失敗。需由審核人以瀏覽器人工開啟官方頁面、核對後新增紀錄；在那之前，新北市使用者只顯示全國共通的 1966 管道。
2. **長期照顧服務法本文**：首批 Assessment 不需要引用；列入第二批。
3. **附表四照顧組合／支付價格**：MVP 不計算個別服務價格，不納入首批。
4. **勘誤版本確認**：2025-10-03 勘誤涉及附表三、四、五。審核人需確認法規資料庫目前掛載的 PDF（上列 FileId）即為勘誤後版本，再核准 `KR-005`、`KR-006`。

---

## 首批內容包

`contracts/knowledge/packs/KP-2026-09-23-001.json`

| recordId | category | jurisdiction | 主題 | effectiveFrom |
|---|---|---|---|---|
| KR-2026-001 | ELIGIBILITY | TAIWAN | 可申請長照服務的資格（辦法第 2 條） | 2026-01-01（第 1 項第 3、4 款） |
| KR-2026-002 | ELIGIBILITY | TAIWAN | 長照需要等級 1–8 級，第 1 級不給付（第 7 條第 1 項） | 2025-09-01 |
| KR-2026-003 | BENEFIT | TAIWAN | 四類給付項目與交通用途限制（第 7、8 條） | 2025-09-01 |
| KR-2026-004 | BENEFIT | TAIWAN | 各等級給付額度（附表二） | 2025-09-01（輔具第二組 2026-07-01） |
| KR-2026-005 | TRANSPORTATION | TAIWAN | 交通接送分區：臺北市、新北市（附表三） | 2025-09-01 |
| KR-2026-006 | COPAY | TAIWAN | 長照身分別與部分負擔比率（第 14 條、附表五） | 2025-09-01 |
| KR-2026-007 | BENEFIT | TAIWAN | 額度給付週期（第 12 條） | 2025-09-01 |
| KR-2026-008 | APPLICATION | TAIWAN | 申請管道、1966 服務時間與流程 | 以擷取日為準 |
| KR-2026-009 | APPLICATION | TAIPEI | 臺北市長期照顧管理中心聯絡資訊 | 以擷取日為準 |

所有紀錄目前狀態皆為 `NEEDS_REVIEW`。**本文件與內容包都不代表已審核或已發布。**
