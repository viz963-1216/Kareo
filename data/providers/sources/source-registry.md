# Kareo Provider Source Registry

> Task: TASK-A-002 — Official Provider Dataset v1  
> Submission Version: A-002-r1  
> Scope: Taipei City / New Taipei City

## Purpose

This registry records the official or traceable primary sources used to build the Kareo Provider Dataset.

Only government, official, or traceable first-party public sources should be treated as formal Provider sources.

Unknown or unverified information must not be guessed.

---

## Source Registry

| Source ID | Source Name | Authority / Organization | Source URL | Provider Type | Jurisdiction | Retrieved At | Notes |
|---|---|---|---|---|---|---|---|
| SRC-001 | 臺北市居家服務機構一覽表 | 臺北市政府社會局 | https://dosw.gov.taipei/News_Content.aspx?n=5EF22734BA80A829&s=B534D9A9215C502D&sms=96505C2A85F034FD | HOME_CARE | Taipei City | 2026-09-18 | Official Taipei City government source; provider list attachment available on source page. |
| SRC-002 | 新北市居家長照機構名冊 | 新北市政府衛生局 | https://www.health.ntpc.gov.tw/ (current list: https://www.careyou.ntpc.gov.tw/w/agecare/unit) | HOME_CARE | New Taipei City | 2026-09-18 | Official government registry; includes provider name, address, service items, phone, and service area. |
| SRC-003 | 臺北市居家護理機構名單 | 臺北市政府衛生局 | https://health.gov.taipei/News_Content.aspx?n=A01CA16FC0C64647&s=480610F542590DA6&sms=BACDBFD1C6E1EF90 | HOME_MEDICAL_NURSING | Taipei City | 2026-09-18 | Official Taipei City government source; includes the Taipei home nursing institution list updated 2026-09-01. |
| SRC-004 | 115年臺北市政府身障輔具暨長期輔具及居家無障礙環境改善特約服務門市名單 | 臺北市政府社會局 | https://dosw.gov.taipei/cp.aspx?n=457FA2416BF17247&s=74E8961109D68F2E | ASSISTIVE_DEVICE | Taipei City | 2026-09-18 | Official Taipei City government source; provides the 2026 contracted assistive-device and long-term-care assistive-device service store list in PDF and ODS formats. |
| SRC-005 | 新北市長照輔具／無障礙服務特約廠商 | 新北市輔具資源中心／新北市政府社會局 | https://atrc.aihsin.ntpc.gov.tw/NewsInfo/24 | ASSISTIVE_DEVICE | New Taipei City | 2026-09-18 | Official New Taipei City assistive-device resource source; provides contracted assistive-device vendor lookup and downloadable vendor lists. |
| SRC-006 | 新北市居家長照機構名冊 11506 | 新北市政府高齡長期照顧處 | https://www.careyou.ntpc.gov.tw/WebUPD/agecare/InstitutionalRoster/%E6%96%B0%E5%8C%97%E5%B8%82%E5%B1%85%E5%AE%B6%E9%95%B7%E7%85%A7%E6%A9%9F%E6%A7%8B%E5%90%8D%E5%86%8A11506.pdf | HOME_CARE | New Taipei City | 2026-09-29 | A-003: name / registered-address check (sha256 `77fb323a…bf33c27`). Its 服務區域 column is city-level only. The A-003-r5 report cited this roster as `SRC-003` by mistake. |
| SRC-COORD-NTPC-001 | 新北市門牌位置數值資料 11509 | 新北市政府民政局 | https://data.gov.tw/dataset/168887 (CSV: https://data.ntpc.gov.tw/api/datasets/d7b568ab-3819-40c8-a6e7-a6b199443101/csv/file) | Coordinates | New Taipei City | 2026-09-29 | A-003: official building address points; fields `x_3826` / `y_3826` are EPSG:3826 (sha256 `72007bb7…f80ccf034`). Use only exact house-number matches. |
| SRC-007 | (市民版)長照專業服務-特約服務單位一覽表 | 臺北市政府衛生局 | https://health.gov.taipei/News_Content.aspx?n=3B14F55B09E96685&sms=8F0619542D0F4F55&s=7FE0B2CCE4515A8D | HOME_MEDICAL_NURSING | Taipei City | 2026-09-29 | A-003: per-unit 服務區域 for LTC professional services (sha256 `bc69fc3a…70272e849a`). Lists parent hospitals separately from affiliated home-nursing agencies. |
| SRC-008 | 臺北市居家護理所一覽表 | 臺北市政府衛生局 | https://www-ws.gov.taipei/Download.ashx?icon=..pdf&n=6Ie65YyX5biC5bGF5a626K2355CG5omA5LiA6Ka96KGoKDExNeW5tDTmnIgyMeaXpeabtOaWsCkucGRm&u=LzAwMS9VcGxvYWQvNjg0L3JlbGZpbGUvNDcyNDEvODA1Nzc3OS80OWYwYTRmNS1iNDM1LTRkZTEtOWI1Mi1kMDYxNzE0ZmFlNjEucGRm | HOME_MEDICAL_NURSING | Taipei City | 2026-09-29 | A-003-r13: official list identifies TP-HMN-001 and TP-HMN-003 as home-nursing agencies and verifies their names, addresses and phones; no district-level service range. |
| SRC-009 | 馬偕紀念醫院：馬偕醫訊 2026 年 02 月號 | 馬偕紀念醫院 | https://www.mmh.org.tw/news_view.php?id=10262 | HOME_MEDICAL_NURSING | Taipei City | 2026-09-29 | A-003-r13: official article index names 「居家醫療到我家 馬偕居家護理所」; supports the actual home-nursing service, not service districts. |
| SRC-010 | 臺大醫院北護分院介紹 | 國立臺灣大學醫學院附設醫院 | https://www.ntuh.gov.tw/hsac/Fpage.action?fid=1801 | HOME_MEDICAL_NURSING | Taipei City | 2026-09-29 | A-003-r13: official page states the branch provides home nursing. Used with SRC-008 to connect TP-HMN-003 to its affiliated branch; not district coverage. |
| SRC-COORD-TPE-001 | 臺北市門牌位置數值資料 | 臺北市政府民政局 | https://data.taipei/dataset/detail?id=b7c8e724-1e98-45ee-a0bd-f3840623ed97 (also https://data.gov.tw/dataset/155472) | Coordinates | Taipei City | 2026-09-29 | A-003: building address points, `臺北市門牌位置數值資料_20260902.CSV` (sha256 `cdae1c5d…29682db55`). CRS EPSG:3826, confirmed by SRC-COORD-TPE-002. |
| SRC-COORD-TPE-002 | 門牌整合檢索系統 門牌圖層 CA/HOUSENO | 臺北市政府民政局 | https://arcgis.tpgos.gov.taipei/arcgis/rest/services/CA/HOUSENO/MapServer/4?f=json | Coordinates (CRS) | Taipei City | 2026-09-29 | A-003: layer `spatialReference` = wkid 102443 / latestWkid 3826. TM2X/TM2Y equal the SRC-COORD-TPE-001 values for all 15 checked addresses. |
| SRC-GMAPS-001 | Google Maps 商家頁 | Google（非官方） | https://www.google.com/maps | ASSISTIVE_DEVICE / HOME_CARE | Taipei / New Taipei | 2026-09-29 | Not an official source. Used only by the recorded instructions DEC-A003-03 (TP-AD-002 house number, cross-checked by the same phone as SRC-004 and by the official address-point data) and DEC-A003-05 (NTPC-HC-003 phone). Never used for coordinates. See `qa/a-003-evidence.json` `decisions`. |
| SRC-011 | 臺北市輔具服務－輔具中心 | 臺北市政府社會局 | https://dosw.gov.taipei/cp.aspx?n=F00D57EC34399445 | ASSISTIVE_DEVICE_CENTER | Taipei City | 2026-10-03 | Official Taipei City government page. Lists the three centres, their addresses, phones, websites and district service areas. |
| SRC-012 | 新北市輔具中心及各分站據點服務項目列表 | 新北市輔具資源中心／新北市政府社會局 | https://atrc.aihsin.ntpc.gov.tw/NewsInfo/131 | ASSISTIVE_DEVICE_CENTER | New Taipei City | 2026-10-03 | Official New Taipei City resource-centre page. Confirms the Luzhou and Xindian centres, addresses, phones and service information. |

---

## Provider Type Reference

| Provider Type | Description |
|---|---|
| HOME_CARE | 居家照顧 |
| HOME_MEDICAL_NURSING | 居家醫療與護理 |
| ASSISTIVE_DEVICE | 輔具 |

---

## Verification Rules

- Prefer government and official public data.
- Every formal Provider must be traceable to a registered source.
- Do not use AI-generated provider information as source data.
- Do not use blogs, social media posts, SEO websites, or unverifiable directories as formal sources.
- Do not infer service areas from provider addresses.
- Unknown information should remain `null` or `UNKNOWN`.
- `verified = true` means Kareo basic data verification, not government certification.

---

## Pending / Unverified Sources

Sources that have not yet been verified should be recorded here before being included in the formal dataset.

| Source Name | URL | Reason Pending | Next Action |
|---|---|---|---|
| None | — | — | — |

## A-007-r2 coordinate verification (2026-10-04)

- `SRC-COORD-TPE-003`: [Taipei official complete address CSV](https://data.taipei/api/dataset/b7c8e724-1e98-45ee-a0bd-f3840623ed97/resource/ce76ca0c-7f94-4935-ab47-1d2a41ca2abb/download), retrieved 2026-10-04; SHA-256 in `qa/a-003-evidence.json`.
- `SRC-COORD-NTPC-002/003`: official address API exact-number queries, then exact district/street/lane/alley matching. Query URLs and response SHA-256 are in `qa/a-003-evidence.json`; [official API guide](https://data.ntpc.gov.tw/applications).
- These sources support building coordinates only. Service coverage still requires its own official evidence; the existing 30 providers and all original service-area records are unchanged.

## A-008-r1（2026-10-08）

- `SRC-FIRST-PARTY-URYARD-001`：[亞德醫材生活館官網](https://www.uryard.com.tw/pages/ntpc-assistive-device-contract)，SHA-256 `93032429c6dfc025fff368952479b097fce10286017365c72304075e09aa8e88`。核對商家名称／地址／電話及明示配送範圍。來源為商家自己，**不是政府證實**；不新增特約資格，不推算座標。細節見 `qa/a-008-real-provider-data.md`。

## 2026-10-08 官方目錄快照（D-20）

機器可讀来源清册：`qa/official-catalog-manifest.json`，含官方網址、取證日、原始 HTML SHA-256。長照輔具 607 列、身障輔具 737 列、智慧科技 4 列全量下載，逐列處理雙北所在地、不同地址門市、重複及排除。不使用 ODS 內部工作表推定有效名單；ODS 僅作對照（資料日期115.9），智慧科技益康最新地址採官方網站60號，不採較舊 ODS 的6號。198居服來源仍為已保存1150810官方PDF，public extract不含负责人姓名；推薦區域只取其實際特約服務區域，未特約／空白／只到宅沐浴車不補一般居服區域。
