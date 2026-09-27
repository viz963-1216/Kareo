# Knowledge Source Registry / 官方知識來源登錄

Submission Version: J-002-r1
Owner: Jerry
Registry version: SR-2026-09-24-01
Status: `SR-2026-09-23-01` 的來源 **SPEC-APPROVED 2026-09-24**（MVP_DECISIONS D-02a，[PR #31 comment](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806704685)）；`SR-2026-09-24-01` 新增 6 個臺北市／新北市來源並停用 `SRC-NTPC-HEALTH-LTC`，2026-09-24 隨 `KP-2026-09-24-002` 由 Jerry 核准

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
| `SRC-LAW-L0020178-T` | 身心障礙者醫療復健費用及醫療輔具補助辦法 附表 醫療復健費用及醫療輔具補助標準 | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000293764&lan=C | 修正日期 110-06-17；附表自 111-01-01 施行；2026-09-24 新增，Jerry 核准 | OK，PDF sha256 `7a1c47a8…07f0be` | true |
| `SRC-TPE-DOSW-AD-TOPUP-PLAN` | 臺北市政府社會局辦理失能者生活輔助器具自辦補助計畫（附件） | `TAIPEI_GOV` | `TAIPEI` | https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvMzU4L3JlbGZpbGUvMTY0OTUvMTE1ODI3L2I0MDUyODJjLTU2NTgtNDMwZS05NzZjLWVjOTY0Zjk4MGQ4MC5wZGY%3d&n=6Ie65YyX5biC5pS%2f5bqc56S%2b5pyD5bGA6L6m55CG5aSx6IO96ICF55Sf5rS76LyU5Yqp5Zmo5YW36Ieq6L6m6KOc5Yqp6KiI55WrLnBkZg%3d%3d&icon=..pdf | 未標示日期；所屬頁面資料更新 115-07-30；2026-09-24 新增，Jerry 核准 | OK，sha256 `43bd72d4…`；2026-09-25 本機 curl 複查 SHA-256 相符 | true |
| `SRC-TPE-DOSW-AD-TOPUP-ITEMS` | 115年臺北市政府社會局失能者生活輔助器具自辦補助計畫之補助項目、額度及規定（附件） | `TAIPEI_GOV` | `TAIPEI` | https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvMzU4L3JlbGZpbGUvMTY0OTUvMTE1ODI3L2QzMWM5M2RiLTYyMTEtNGYzMi1iOWY2LWE1YzA2ZDI2MzMxOS5wZGY%3d&n=MTE15bm06Ie65YyX5biC5pS%2f5bqc56S%2b5pyD5bGA6L6m55CG5aSx6IO96ICF55Sf5rS76LyU5Yqp5Zmo5YW36Ieq6L6m6KOc5Yqp6KiI55Wr5LmL6KOc5Yqp6aCF55uu44CB6KOc5Yqp5pyA6auY6aGN5bqm5Y%2bK6KOc5Yqp55u46Zec6KaP5a6aLnBkZg%3d%3d&icon=..pdf | 115 年度；2026-09-24 新增，Jerry 核准 | OK，sha256 `b019957b…`；2026-09-25 本機 curl 複查 SHA-256 相符 | true |
| `SRC-TPE-DOSW-HOME-MOD-NOTES` | 臺北市居家無障礙環境改善補助注意事項（附件） | `TAIPEI_GOV` | `TAIPEI` | https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvMzU4L3JlbGZpbGUvMTY0OTUvMTE1ODI3L2UxMTk4NzNkLTAzNzgtNDczMi05ZDE2LTA4MjUwZmY1NzgwZC5wZGY%3d&n=5bGF5a6254Sh6Zqc56SZ55Kw5aKD5pS55ZaE6KOc5Yqp5rOo5oSP5LqL6aCFLnBkZg%3d%3d&icon=..pdf | 未標示日期；2026-09-24 新增，Jerry 核准 | OK，sha256 `c00a0f54…`；2026-09-25 本機 curl 複查 SHA-256 相符 | true |
| `SRC-TPE-HEALTH-RESPITE-NEWS` | 臺北市政府衛生局新聞稿「北市長照喘息服務，減輕照顧者壓力」 | `TAIPEI_GOV` | `TAIPEI` | https://health.gov.taipei/News_Content.aspx?n=4F01EBDF8F61F315&sms=72544237BBE4C5F6&s=B50D5370D99E02DC | 資料更新 114-04-18；2026-09-24 新增，Jerry 核准 | OK，sha256 `9bfe4052…`；2026-09-25 本機 curl 複查 SHA-256 相符 | true |
| `SRC-LAW-L0070040` | 長期照顧服務法 | `LAW` | `TAIWAN` | https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070040 | 尚未擷取原文 | 未擷取（首批不產生紀錄） | true |
| `SRC-NTPC-HEALTH-LTC` | 新北市政府衛生局 長期照顧相關頁面 | `NEW_TAIPEI_GOV` | `NEW_TAIPEI` | https://www.health.ntpc.gov.tw/basic/?node=10081 | 2026-09-24 複查：頁面轉址至衛生局文章頁，長照業務已移至高齡長期照顧處網站（careyou.ntpc.gov.tw），由下列新北市來源取代 | **FETCH_FAILED**（僅回傳轉址） | false |
| `SRC-TPE-DOSW-LTC-TRANSPORT` | 臺北市政府社會局「長期照顧交通接送服務-申請說明」 | `TAIPEI_GOV` | `TAIPEI` | https://dosw.gov.taipei/cp.aspx?n=1847C5A001C1DC3C | 資料更新 115-09-04；2026-09-24 新增，Jerry 核准 | OK，HTML sha256 `97d609c3…0d90` | true |
| `SRC-TPE-DOSW-HOME-CARE` | 臺北市政府社會局「居家服務-洽辦資訊」 | `TAIPEI_GOV` | `TAIPEI` | https://dosw.gov.taipei/cp.aspx?n=F07637F92E4E85A0 | 資料更新 115-06-05；2026-09-24 新增，Jerry 核准 | OK，HTML sha256 `89a88b52…a1b4` | true |
| `SRC-NTPC-ESERVICE-LTC` | 新北市政府雲端櫃檯「長期照顧服務」案件說明 | `NEW_TAIPEI_GOV` | `NEW_TAIPEI` | https://service.ntpc.gov.tw/eservice/CaseData.action?itemId=124014 | 頁面未標示日期；2026-09-24 新增，Jerry 核准 | OK，HTML sha256 `478c31f6…05c9` | true |
| `SRC-NTPC-CAREYOU-BRANCH` | 新北市政府高齡長期照顧處「長照服務管理中心」 | `NEW_TAIPEI_GOV` | `NEW_TAIPEI` | https://www.careyou.ntpc.gov.tw/w/agecare/care-branch | 網站最後更版 2026-06-16（全站）；2026-09-24 新增，Jerry 核准 | OK，HTML sha256 `d2777a90…1df0` | true |
| `SRC-NTPC-CAREYOU-LTCTS` | 新北市政府高齡長期照顧處「民眾交通使用須知」 | `NEW_TAIPEI_GOV` | `NEW_TAIPEI` | https://www.careyou.ntpc.gov.tw/w/agecare/ltcts | 附件須知 1150805 版；網站最後更版 2026-06-16；2026-09-24 新增，Jerry 核准 | OK，HTML sha256 `53e11523…2fda` | true |
| `SRC-NTPC-ESERVICE-AD` | 新北市政府雲端櫃檯「長期照顧輔具服務及居家無障礙環境改善服務補助」 | `NEW_TAIPEI_GOV` | `NEW_TAIPEI` | https://service.ntpc.gov.tw/eservice/CaseData.action?itemId=110105 | 頁面未標示日期；2026-09-24 新增，Jerry 核准 | OK，HTML sha256 `754f7986…bfe5` | true |

完整雜湊值見 `contracts/knowledge/packs/KP-2026-09-23-001.json` 各紀錄的 `source.contentHash`。

---

## Jerry 指定資料夾（D-15，2026-09-24）

資料夾：Google 雲端硬碟「Kareo／2.網頁架構補充資料」，folder id `1h3pDfDYOy1Qo4OOiP9duUJ4DUK0NJ6Fh`。只有下表登錄的檔案可作為來源（`authority = KAREO_DRIVE`）；檔案真實性與版本由 Jerry 負責。B-009 不公開抓取這些檔案；Jerry 更新檔案時，J-002 以新內容包提交。

| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 原發布機關／版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| `SRC-DRIVE-NTPC-AD-TOPUP` | 新北市政府身心障礙者輔具費用補助基準（新北市加碼） | `KAREO_DRIVE` | `NEW_TAIPEI` | https://drive.google.com/file/d/1V_dZRAeeUGYLKR_JrFFUg2g0un4nFmh5/view | 新北市政府社會局；文件未標示日期或版次 | OK（2026-09-24 由 Jerry 下載提供），PDF sha256 `20ce2c4c…883b`；→ KR-2026-016 | true |
| `SRC-DRIVE-NTPC-MED-AD` | 新北市身心障礙者醫療費用及醫療輔具補助標準表 | `KAREO_DRIVE` | `NEW_TAIPEI` | https://drive.google.com/file/d/1kl8JtMUNozsWeKxKzjBEG2bm_29R_690/view | 新北市政府；文件標示「102.03.13 修」（2013 年，需確認是否仍有效） | OK，PDF sha256 `a7b9fda4…656a`；→ KR-2026-017 | true |
| `SRC-DRIVE-LTC-PAY-T3` | 長期照顧給付及支付基準－附表3 | `KAREO_DRIVE` | `TAIWAN` | https://drive.google.com/file/d/1WH5OA2sdc1gs8TG5RAzx1k-767F74Jaa/view | 衛生福利部；檔案未標示版次，頁碼自 30 起（節錄本） | OK，PDF sha256 `3a2d6a0e…`；**僅供參考**：MVP 不計算個別品項價格，未產生紀錄 | true |
| `SRC-DRIVE-AD-CODES` | 輔具代碼 | `KAREO_DRIVE` | `TAIWAN` | https://drive.google.com/file/d/10W9SlpFhfN92bJJC8vQKGchtCUZZZ6-N/view | 未標示版次，頁碼自 41 起；與附表3 為不同版次的 E／F 碼表 | OK，PDF sha256 `a4d68908…`；**僅供參考**，未產生紀錄 | true |
| `SRC-DRIVE-LTC-PAY-FEES` | 長期照顧給付及支付基準收費標準（docx） | `KAREO_DRIVE` | `TAIWAN` | https://drive.google.com/file/d/17jbyW9we5UJn9o7UDAvq7mXr4nRPM8EE/view | 整理表（非官方原文格式），未標示日期 | OK，docx sha256 `1cf2df08…`；**僅供參考**；發現錯誤：CD02 中低收 5% 應為 300，檔案寫 450 | true |
| `SRC-DRIVE-LTC-CODES` | 長照代碼（內容為「長期照顧服務申請及給付辦法」條文說明對照表） | `KAREO_DRIVE` | `TAIWAN` | https://drive.google.com/file/d/1WocJI8bQUPeqM92H6zSBW5cymzB2tdmW/view | **舊版**：第二條寫「五十歲以上失智症」，與現行條文（2026-01-01 起不限年齡，KR-2026-001）不符 | OK，PDF sha256 `e2d43847…`；**停用**，不得作為來源 | false |
| `SRC-DRIVE-NTPC-TRANSPORT-RULES` | 新北市特約交通使用須知 | `KAREO_DRIVE` | `NEW_TAIPEI` | https://drive.google.com/file/d/1YuMFW3Jz3Y2thgrCAPj338HaNocvFH5C/view | 新北市政府衛生局高齡長期照顧處；檔案版本 **1140411**（早於官網的 1150417、1150805） | OK，PDF sha256 `5481bc26…`；較舊，KR-2026-014 維持以官網為準；未產生紀錄 | true |

A+分站交通平台教育訓練手冊.pdf 為單位內部操作文件，不登錄為知識來源。

---

## 已知缺口（不得以非官方資料補齊）

1. ~~新北市照管中心聯絡方式~~：2026-09-24 已由高齡長期照顧處網站取得，見 `KP-2026-09-24-002` KR-2026-013（待審核）。
5. **地方加碼補助**：2026-09-24 查閱臺北市社會局／衛生局與新北市衛生局／高齡長期照顧處官方頁面，**未找到**長照 2–8 級給付以外的地方現金加碼補助；兩市公告的是使用中央給付的地方規則（交通接送、申請管道、輔具請款流程）。若日後找到官方加碼方案，以新內容包提交。
6. ~~臺北市輔具／喘息的地方流程~~（2026-09-25 複查：社會局「長期照顧輔具服務」頁仍為同 15 個附件，資料更新 115-07-30，未見 116 年公告）：2026-09-24 已開啟社會局附件，整理為 `KP-2026-09-24-005`（KR-2026-019～022；022 已核准，019～021 於 2026-09-24 查核後修正、待重新核准）。臺北市有自辦的失能者生活輔助器具補助（18 項）；喘息服務無地方加碼金額。
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
