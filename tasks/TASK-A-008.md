# TASK-A-008 — Real Provider Data and Traceable Service Coverage

Owner: Engineer A；本輪由 Jerry 授權 Codex 中心整合執行。
Submission Version: A-008-r5
Status: r1～r5 MERGED (#104/#107/#108/#109/#115)；r4 新北官方居服全名冊已差額匯入 Supabase；r5 完成19筆電話修正、逐筆線上API讀回與Pages快照同步。尚有居護全名冊／輔具未知範圍待補，不宣稱全類別全量完成。

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

PR → staging；Title `[A-008] Import official New Taipei home-care catalogue`。本輪與 J-004-r15 在同一中心 PR 交付。

## r4 — 新北衛生局轉介的最新居家服務特約全名冊（2026-10-08）

依衛生局官方轉介至高齡長期照顧處，取1151007、24頁、序號1～366全名冊。318新增、48沿用既有ID；原800及全部子表列保持原值，新增1394筆明示新北行政區範圍。四間位於桃園／基隆但官方證實服务新北者納入，僅建立新北範圍。三木暫停派案至11/5，保留但停用；不自動按日期解除。喘息／短照各依自己的勾選欄位顯示。合計1118資源、517居服（516 ACTIVE），1101服務、2517範圍、588輔具特約、1111公開補充。來源快照、366筆處置、SHA、原800 baseline及負向測試見 `qa/ntpc-home-care-*`。

## r2 — 官方名冊與分類擴充（2026-10-08，中央整合，Issue #106）

本輪逐筆處理 198 筆居服（197 筆雙北保留／合併，基隆未特約 1 筆記錄排除）；與既有資料合併後 199 家居服。臺北市政府輔具購置（長照／身障）、智慧科技輔具官方目錄依所在地過濾，分別保留不同地址門市；共 581 筆輔具資料。17 個中心／分站維持查詢用途，原始 36 筆及其既有範圍不刪除。來源、電話／行政區文字正規化、原地址不一致警示、每筆處理清冊見 `data/providers/qa/official-catalog-report.md`。未特約、區域空白不建推薦範圍，原 12 商家及 2 居護未知區域仍待直接證據；本輪不宣稱這些覆蓋已完成。

## r3 — 同門牌別名與主電話回查

合併三組同名同電話同門牌、路段中文／數字差異的重複 ID，保留各來源列及分類。修正新資料的手機／0800 第一主號；新增可重現負向檢查。r13 初匯入 803，r3 canonical 為 800 筆。居服199／居護3／輔具581／中心17，知識與健康資料不改。

2026-10-08 r4 執行收尾：#109 已合併；雲端逐欄核對318新增／48補充／1394範圍一致，原800及原子表不變。公開頁新北365、板橋159與DB一致。八項CI、50項實際LOCAL HTTP、71項資料QA通過。參見 [J-004-r15實際執行證據](../docs/acceptance/J004-2026-10-08-ntpc-home-care.md#executed-closeout--2026-10-08)。

## 2026-10-09 r5 電話品質修正

修正19筆新北官方居服電話換行串接；來源快照、服務區域、原800筆與停派狀態保留。資料QA 73項與隔離SQL patch 2項通過；patch遇已變更資料整批拒絕，重跑一致。詳見 `data/providers/qa/ntpc-home-care-report.md` r5段落。居護全名冊／輔具未知服務範圍仍待補。雲端同步與公開詳細頁複驗另附PR證據。

2026-10-09 雲端與發布完成：PR #115 → staging 569f19c；Supabase19/19電話讀回正確，其他四表／欄位指紋不變。Netlify既有release版本直接讀取更新，未重建；Pages快照源569f19c，實際網頁電話一致。詳見 `docs/acceptance/J003-2026-10-09-public-data-verification.md`。
