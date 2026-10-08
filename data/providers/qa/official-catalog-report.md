# 官方資源名冊擴充 — 2026-10-08

Submission Version: A-008-r3 / J-004-r14
Scope: public directory and acceptance data; not formal release acceptance.

## Source reconciliation

| Source | Input rows | Retained / merged in scope | Excluded |
|---|---:|---:|---:|
| 1150810居服PDF（含跨縣市名冊） | 198 | 197 | 1 |
| 臺北社會局長照／身障／智慧目錄 | 1348 | 904 | 444 |

逐列處理清冊為 `official-catalog-manifest.json`；原始PDF／HTML與SHA均可重驗。198為來源母體：197筆雙北保留／去重，1筆（序號142）基隆且未特約排除；既有原15家与來源13家重疊，新增184家，故合計199家居服。既有30服務單位＋5中心＋亞德共36筆及其原始子表列完整保留。

## Current inventory

| Type | Count |
|---|---:|
| HOME_CARE | 199 |
| HOME_MEDICAL_NURSING | 3 |
| ASSISTIVE_DEVICE | 581 |
| OTHER | 17 |
| TOTAL | 800 |
| ProviderService rows | 783 |
| Active ProviderServiceArea rows | 1123 |
| ProviderContractRegion rows | 588 |
| publicInfo rows | 791 |

## Meaning and limits

- r14 公開頁回查發現三組同門牌路段文字差異，已合併麥尼克（二段／2段）、輔聚（四段／4段）、益康（一段／1段）；原始來源列完整保留並映射到同一 ID，分類合併。不同門牌分店仍獨立。初次 r13 匯入 803 筆；去除這三組重複後 800 筆，輔具購置 575 筆、智慧科技 4 筆，可重疊。
- 另修正 9 筆公開主電話：6 筆手機／0800 被錯取內部「02」片段，3 筆改採來源列最前面的完整手機（原第二支市話仍留在 raw extract）。新增 gate 防止相同門牌重複與手機／免付費截斷；不改原 36 筆不可變資料。

- 198不等於所有單位能承接任何區域；官方空白／未特約不補服務區域。到宅沐浴車的全市範圍不推定成一般居服；評鑑不合格保留原文且推薦卡補提醒。
- 輔具PURCHASE涵蓋長照／身障目錄；SMART_TECH四家採目前官方HTML，分別在雙北。特約標示不是配送或到府範圍，未知區域不進Top3。
- 依官方網站結構分類，具體可購置／租賃／品項及補助资格需依核定確認。較舊ODS僅作對照，不匯入內部工作表，不套用舊益康6號地址；SMART採目前60號。
- 同名不同地址門市分別收錄；同名同地址的跨目錄列合併制度分類。原機構有較舊地址時不覆寫 baseline，在publicInfo.notice列出官方來源地址差異，保留逐列可追溯性。
- 新增12個新北系統分站（汐南所在地是臺北南港），原五中心保留，共17。分站不辦補助核定／請款；評估需預約、二手簡易維修及庫存諮詢按來源標示。
- 電話只取公開主號，分機轉為#；原始全部電話保留在extract，逐列轉換見catalog-phone-normalization.json。
- 官方舊行政區文字「新北市新莊思源路」「新北市蘆洲市」分別正規化新莊區、蘆洲區；原文留在manifest。
- 居服一格「格大同、中山、大安、中正」為表格抽取的評鑑末字溢入，以合法區名清洗，原始extract与sourceText保留。
- 新增座標均null；Maps為地址查詢連結，不偽造商家地圖精準座標或距離排序。
- Repository公開查詢及推薦依500列分頁，避免1123列範圍被PostgREST預設1000列截斷。

## Sources

| Source | URL | Snapshot SHA-256 |
|---|---|---|
| SRC-CATALOG-LTC-20261008 | https://dosw.gov.taipei/News.aspx?n=6854E6E5034F6BCD&sms=5020D35947A0ED8D | 5b1b27f14588515d6d00197c4816586d8eed19c1e7d77be90fd36c9e9f040077 |
| SRC-CATALOG-DISABILITY-20261008 | https://dosw.gov.taipei/News.aspx?n=4D051AF0E1FF3B72&sms=BE9D598A6E448581 | 080ad8409b34fd2404d8d1c6dbe430803dd0bf34c7310c2c20d7dcf57c90c50d |
| SRC-CATALOG-SMART-20261008 | https://dosw.gov.taipei/News.aspx?n=06B482D5784555B8&sms=F74A93791FE8674A | f0386c0313142f57ffd669c2f9267a795c86fc65e5ded5469dcf8be7b605d52f |
| SRC-CATALOG-NTPC-20261008 | https://atrc.aihsin.ntpc.gov.tw/NewsInfo/131 | 0c5d03b10f920724fe18ca3e4bf8f2fa5bb9a4e2f25796c88132da62129a2d73 |
| SRC-CATALOG-TPE-20261008 | https://dosw.gov.taipei/cp.aspx?n=F00D57EC34399445 | 1c2ffb396d176739db57be724a012f4b85a9edf6358a2d0940802375daf760e3 |

## Required checks

A-004 validator、A-003 evidence、A-007 immutable baseline、official-catalog reconciliation均須PASS。負向對照涵蓋刪除來源列／provider、杜撰配送範圍、中心進推薦、錯分類及1000列後資料讀取失敗。正式D-05／部署E2E不由本報告替代。
