# J-004-r12／A-008-r1 公開真實資料版

2026-10-08，依 Jerry 要求：公開網站不再顯示固定假機構與固定評估回應，依實際輸入比對真實單位。這取代 r11 虛構機構的公開展示方式；正式 D-05、真實 Lead、49 項部署 E2E 的狀態不變。

## Scope

Allowed：frontend API 接線／顯示、public snapshot、Provider 資料／證據／驗證、build/deploy scripts、針對實際程式的 regression tests、task／報告。Forbidden：正式同意啟用、schema／RLS、私密資料公開、健康資料雲端寫入、Kareocar、付費。

Input：原已核對 35 資源、驗收 DB 目前 PUBLISHED 的 KB-2026-09-24-001 公開 21 筆知識、使用者選項、新查到的商家第一手服務範圍。
Output：GitHub Pages 可分享的真實資源版；實際既有規則引擎依回答計算，既有 B-013 filter service 查詢。公開資料為建置快照，不宣稱即時 DB 查詢。
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

PR #104 已合併到 staging，merge `8d73cdae3006a0bb0d47fd97bb9ba6f71308b7f4`；審查 head `761bed891d8861da27d2672acab5bf27be429336`。

- CI run [37713905618](https://github.com/viz963-1216/Kareo/actions/runs/37713905618)：8 jobs SUCCESS；backend 760 PASS；Functions handler 檢查 86 PASS／0 PENDING／0 FAIL。
- Local HTTP run [37713905708](https://github.com/viz963-1216/Kareo/actions/runs/37713905708)：50 個 LOCAL 案例 PASS。新增真實商家造成舊固定筆數不符，已更新 LOCAL-01 為 36／31／119／19；未刪除案例或放寬行為檢查。
- GitHub Pages artifacts branch `demo-pages`；source `761bed891d8861da27d2672acab5bf27be429336`，artifact `3f038c21ae403f1a2d542edf64c6483affbb1cf3`。公開版本 manifest 的 scope 為 STATIC-PUBLIC-DATA-PREVIEW，不代表 real API 已啟用。

### 真正公開網站操作（2026-10-08）

使用虛構選項，未填姓名、聯絡方式或自由文字。在 https://viz963-1216.github.io/Kareo/ 實際操作：

- 新北三重、居家照顧是：全曜、禾薪、旺福 3 家真實機構；地址、電話及 Maps 使用實際資料。
- 相同需求改土城：僅全曜 1 家，原因為其已核對範圍包含土城；不以所在地取代服務範圍，也不補足 3 家。
- 輔具是：推薦亞德醫材生活館 1 家，沒有混入原 12 家未確認到府範圍的商家。
- 四項需求都改否：顯示「目前沒有明確服務建議」，沒有固定居服／輔具推薦。
- 公開資源查詢輸入「吉評」：僅 1 筆吉評醫療器材股份有限公司，顯示真實電話、地址；範圍待確認仍可查詢。

以上是公開資料版 UI 證據，不填入 49 項正式部署 E2E 結果；Integrated 維持否。

### 驗收 Supabase 實際差額匯入

專案 `ojawadobnaxduxybqolk`，2026-10-08。先鎖定四張 Provider 表並核對原始筆數、完整 row JSON 的 digest；透過既有 `import_provider_dataset` 原子 RPC 只新增 1 provider、1 service、21 areas、0 contracts，未修改 schema／RLS。

匯入後 provider 36、service 31、area 119、contract 19；類別為居家照顧 15、居家護理 3、輔具商家 13、資源中心 5。新 ID `NTPC-AD-010` 的 21 區與 repo 一致。

排除新增 ID 後，匯入前後原始 row digest 完全相同（包含原時間欄位）：

| 原始資料表 | MD5 of ordered JSONB rows（前後相同） |
| --- | --- |
| providers | 394e52ee50b7600065dd539cf211ac51 |
| provider_services | 00bf488e595cc66f65105ab083822d82 |
| provider_service_areas | 9b4ffe44bf154f4a829c09ba8aadcffe |
| provider_contract_regions | 6aaca2fe6d1c48485058672e4195f920 |

未讀取／寫入個案健康或聯絡資料。公開 Pages 仍使用建置時的公開資料快照；資料庫新資料不會無部署自動出現在 Pages。
