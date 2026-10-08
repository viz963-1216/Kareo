# J-004-r12／A-008-r1 公開真實資料版

2026-10-08，依 Jerry 要求：公開網站不再顯示固定假機構與固定評估回應，依實際輸入比對真實單位。這取代 r11 虛構機構的公開展示方式；正式 D-05、真實 Lead、49 項部署 E2E 的狀態不變。

## Scope

Allowed：frontend API 接線／顯示、public snapshot、Provider 資料／證據／驗證、build/deploy scripts、針對實際程式的 regression tests、task／報告。Forbidden：正式同意啟用、schema／RLS、私密資料公開、健康資料雲端寫入、Kareocar、付費。

Input：原已核對 35 資源、驗收 DB 目前 PUBLISHED 的 KB-2026-09-24-001 公開 21 筆知識、使用者選項、新查到的商家第一手服務範圍。
Output：GitHub Pages 可分享的真實資源版；實际既有規則引擎依回答計算，既有 B-013 filter service 查詢。公開資料為建置快照，不宣称即時 DB 查詢。
Acceptance：需求與地區改變會改變結果、僅列符合範圍者最多 3 家、沒有候選為空、輔具中心只查詢、無 mock provider、不送個案至任何 API、原資料不刪除。

## Implementation

重用 B-010 RuleBasedAssessmentEngine＋已發布知識；重用 B-013 lookupProviders；以瀏覽器 WebCrypto SHA-256 執行與 B-005 相同的縣市／行政區輪替種子。GPS、自由文字、聯絡表單、管理登入停用；本機重新開始清除回答，媒合直達路由及 API 均拒絕假送出。一般 real build／consent guard 不變。

新增真實輔具商家亞德一筆及其明示 21 行政區配送範圍；FIRST_PARTY 與政府證據分開、不可偽裝政府特約；缺座標保持 null。原 35 筆全部保留。

## Verification before publication

- Frontend：81 tests PASS；typecheck／real build PASS，real bundle 不含 mock IDs 或 public-preview 資料。
- Provider：A-004 0 errors、來源／座標 gate PASS、immutable baseline PASS、54 tests PASS。
- 新增 7 項實際 adapter regression：NO 優先、三重 3／土城 1／坪林 0、真實輔具商家／原 12 未知範圍不冒充候選、36 資源／5 查詢中心、知識轄區、錯誤地區／失效／GPS拒絕、WebCrypto 與後端 hash 一致。
- 全部 backend 初跑 759 PASS／1 FAIL：舊 Provider Import 測試硬寫 30 家，新增商家後改為 31；相同 import gate 重跑與 CI 結果在下方追加。

## Publication / Database

待本 PR CI／公開瀏覽器操作及驗收 DB 差額匯入後追加實際版本和證據。不得把此範圍算成完整 49 項正式部署 E2E。
