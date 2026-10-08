# TASK-A-008 — Real Provider Data and Traceable Service Coverage

Owner: Engineer A；本輪由 Jerry 授權 Codex 中心整合執行。
Submission Version: A-008-r2
Status: r1 MERGED (#104)；首筆新增商家已差額匯入驗收 DB、既有名單已公開接線。尚有資料覆蓋待補，不宣稱全量範圍完成。

## Goal

使用者要求公開網址依實際需求／地區列出真實居家照顧、居家護理與輔具單位。保留 A-003／A-006／A-007 原有全部資料，補查缺失，禁止測試機構或為湊三家杜撰服務範圍。

## Allowed Paths

`/data/providers/**`。本次跨模組接線／匯入證據由 J-004 中心負責，不由 A 修改前後端。

## Forbidden Paths

`/apps/**`、`/contracts/**`、雲端 schema／RLS、正式同意版本、其他 Supabase 專案或 Kareocar。不得聯繫商家或改政府特約欄位來湊推薦。

## Input and Output

Input：PRODUCT_SPEC §14a／§19；原有 35 筆名單；官方機構名冊、商家本身的可追溯公開服務頁。
Output：可匯入的 Provider／Service／ServiceArea／ContractRegion JSON、每筆來源／日期／SHA-256、待確認清單與由 gate 重算的報告。

## Acceptance Criteria

- 原有 35 筆資源及所有既有範圍完整保留；A-007 immutable baseline 通過。
- 居家護理須證實是該單位本身的居家服務，不能套用母醫院範圍。
- 服務範圍只用直接證據；政府來源 OFFICIAL、商家自己的陳述 FIRST_PARTY 分開。FIRST_PARTY 必須同官網網域、來源類型、取證日、SHA-256、明示服務文字；不可改標政府證實。
- 未確認的服務範圍仍可資源查詢但不進推薦；未驗證座標保持 null、使用行政區排序，不算距離。
- 特約縣市需主管機關名單交叉核對；商家自行宣称不等於特約事實。輔具中心仍只查詢。
- 執行 A-004 gate、座標／來源 gate、immutable baseline 及反例測試。
- DB 匯入由中心在核對驗收專案後，透過既有 import_provider_dataset 原子函式完成；只增本次差額，原有資料不變。

## r1 Delivered / Remaining

已補亞德醫材生活館一筆、輔具服務一筆、明示配送行政區 21 筆；官方特約欄位不新增，座標保留 null。來源／證據見 `data/providers/qa/a-008-real-provider-data.md`。
仍待後續研究：原 12 家輔具商家的到府服務範圍、2 家居家護理所的行政區範圍、新商家座標與特約資格。找不到直接證據就保留待確認，不填假資料。

PR → staging；Title `[A-008] Real provider data and traceable service coverage`。本輪與 J-004-r12 在同一中心 PR 交付。

## r2 — 官方名冊與分類擴充（2026-10-08，中央整合，Issue #106）

本輪逐筆處理 198 筆居服（197 筆雙北保留／合併，基隆未特約 1 筆記錄排除）；與既有資料合併後 199 家居服。臺北市政府輔具購置（長照／身障）、智慧科技輔具官方目錄依所在地過濾，分別保留不同地址門市；共 584 筆輔具資料。17 個中心／分站維持查詢用途，原始 36 筆及其既有範圍不刪除。來源、電話／行政區文字正規化、原地址不一致警示、每筆處理清冊見 `data/providers/qa/official-catalog-report.md`。未特約、區域空白不建推薦範圍，原 12 商家及 2 居護未知區域仍待直接證據；本輪不宣稱這些覆蓋已完成。
