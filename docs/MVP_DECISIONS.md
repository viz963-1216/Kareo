# Kareo MVP Decisions / MVP 決策紀錄

Submission Version: J-002-r4
Owner: Jerry
Last reviewed: 2026-09-23

本文件記錄 2026-10-22 MVP 所需決策與每項交付的核准狀態。

**J-002-r4 開發基準（2026-09-23）**：依 Jerry 指示，所有任務依**原始 MVP**（PRODUCT_SPEC `c28f27f` 起的內容）＋下方 `SPEC-APPROVED` 變更開發。會縮減原始範圍的提案（D-08、D-11、D-12）一律**未核准、已擱置**：保留紀錄，但不列入待決事項、不影響任何任務排程或驗收。這是停止把提案當待決事項，**不是**核准或否決紀錄。

**最高產品依據**：`docs/PRODUCT_SPEC.md` 的原始 MVP，加上 Jerry 明確核准並留下證據的變更（本文件狀態為 `APPROVED` 的項目）。TASK、決策提案、資料不足或程式暫時做不到，都**不會**縮減原始 MVP 範圍。要縮減範圍，必須在本文件登記為「範圍變更提案」，經 Jerry 核准後修訂 PRODUCT_SPEC（§58 Change Rule）。

---

## 狀態定義

一項交付可能同時處於不同層級的狀態，必須分開記錄，不得互相代替：

| 層級 | 狀態 | 意義 | 誰能改 |
|---|---|---|---|
| 決策／規格 | `PROPOSED` | 已有具體方案，**等待 Jerry 核准**。下游只能做「可逆」的準備（可隨提案修改而改寫），不得當作定案，不得據此宣稱驗收通過 | J-002 |
| 決策／規格 | `SPEC-APPROVED` | Jerry 已留下核准紀錄（連結填於「核准證據」）。下游可依此實作與驗收 | Jerry |
| 範圍變更 | `CHANGE-PROPOSED` | 會縮減或改變原始 MVP 的提案。**核准前原始 MVP 要求維持不變**，工程師依原始要求工作 | J-002 提出、Jerry 決定 |
| 範圍變更 | `SHELVED` | 未核准、已擱置的範圍變更提案。開發與驗收依原始 MVP；要重提必須走新的 Change 流程（PRODUCT_SPEC §58） | Jerry |
| 資料 | `DATA-GAP` | 原始要求不變，但目前缺資料或功能，無法測試或提供。必須列出補齊的負責人與驗收 | J-002 |
| 外部輸入 | `BLOCKED` | 缺人、帳號、額度或法務意見，不得以假設解鎖 | Jerry |
| 知識內容 | `NEEDS_REVIEW` → `APPROVED`（內容核准）→ `PUBLISHED`（已在資料庫發布） | 見 `contracts/knowledge/README.md`。只有 `PUBLISHED` 可被正式 Assessment 使用 | 審核人／J-003 |

規則：

1. **PR 合併 ≠ 核准。** 規格 PR 合併只代表「文件進入 staging、可供開發參考」。其中的提案、內容包、文案都維持原狀態，不會因合併自動變成 `SPEC-APPROVED` 或 `APPROVED`。
2. 「核准證據」只能填真實連結（PR review／comment、Issue）。空白＝尚未核准。
3. `NEEDS_REVIEW` 的知識不得被 staging／production 的正式 Assessment 使用，也不得在驗收紀錄中當成「已有知識」。
4. 本文件不代表任何外部服務已購買、任何人已同意擔任接件人、或任何法務意見已取得。

---

## 決策總表

| ID | 決策 | 狀態 | 版本 | Decision owner | 核准證據 | 下游任務 |
|---|---|---|---|---|---|---|
| D-01 | Assessment 判斷方式 | **SPEC-APPROVED：方案 B 規則引擎，不使用 AI**（已修訂 PRODUCT_SPEC §16） | D-01-v2 | Jerry | [PR #19 comment 2026-09-23](https://github.com/viz963-1216/Kareo/pull/19#issuecomment-5788470099) | B-010、J-003、J-004 |
| D-01a | 規則表、關鍵字、Summary 模板、**補助說明模板與知識對應**（`RULES-2026-09-23-r2`，ASSESSMENT_RULES §6） | PROPOSED（逐條待確認） | r2 | Jerry | — | B-010、C-005、J-003 |
| D-02 | 首批知識內容包 `KP-2026-09-23-001`（9 筆） | **內容 APPROVED（9／9，2026-09-24 Jerry）；尚未 PUBLISHED** | D-02-v1 | Jerry（審核人） | 內容包逐筆 `review`；[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806103227) | J-003 首次發布、B-010 |
| D-02a | 官方來源白名單與 Source Registry `SR-2026-09-23-01` | PROPOSED；新北市來源擷取失敗（**DATA-GAP**） | D-02a-v1 | Jerry | — | B-008（已合併）、B-009、J-002 地方知識 |
| D-03 | 知識內容包格式、匯入驗證、發布／撤回規則 | PROPOSED。**B-008 已依此合併（PR #26），但沒有核准紀錄** | D-03-v1 | Jerry | — | B-008、J-003 首次發布 |
| D-04 | 匿名 session 持有證明、有效期、資源歸屬、濫用限制、冪等、刪除（API_CONTRACT v0.2 §3） | PROPOSED | D-04-v1 | Jerry | — | B-011a、B-005、B-006、J-003 adapter |
| D-05 | 隱私、同意版本、保存／刪除、外部資料流 | PROPOSED；法務 **BLOCKED** | D-05-v1 | Jerry | — | B-011、C-005、J-004 |
| D-06 | Lead 接件方式、角色、狀態轉移、回覆時程 | PROPOSED；接件人 **BLOCKED** | D-06-v1 | Jerry | — | B-006、J-004 |
| D-07 | 推薦排序：有精確位置依距離、只有行政區穩定輪替、無位置不宣稱附近（PRODUCT_SPEC §21–24） | **原始 MVP 要求（不變）**；Provider 座標 **DATA-GAP**（0／30） | D-07-v3 | Jerry | PRODUCT_SPEC §20–24 | A-003-r2、B-005、C-005、J-003 |
| D-08 | MVP 不收集 GPS | **SHELVED（未核准、已擱置）**：精確位置依原始 MVP 開發 | D-08-v2 | Jerry | — | 無（不影響任何任務） |
| D-09 | Netlify 部署額度與部署觸發策略 | PROPOSED；額度 **BLOCKED** | D-09-v1 | Jerry | — | J-003、J-004 |
| D-10 | 多表原子寫入方式（B-004 Provider 匯入） | **SPEC-APPROVED：方案 A，Postgres function 單一交易** | D-10-v1 | Jerry | [PR #16 comment 2026-09-23](https://github.com/viz963-1216/Kareo/pull/16#issuecomment-5788552476) | B-004、J-003。**B-008（已合併）的發布／撤回函式沿用此模式，但延伸使用沒有核准紀錄**（見 D-10 末段） |
| D-11 | crawler 延後、MVP 先人工每日檢查 | **SHELVED（未核准、已擱置）**：B-009 每日 00:10 更新依原始 MVP 開發 | D-11-v1 | Jerry | — | 無（不影響任何任務） |
| D-12 | 結果頁不顯示給付金額／部分負擔 | **SHELVED（未核准、已擱置）**：補助說明依原始 MVP，模板見 ASSESSMENT_RULES §6.3 | D-12-v1 | Jerry | — | 無（不影響任何任務） |
| D-13a–g | 位置流程中原始規格未決定的細節（只有縣市、無位置回應、缺座標、GPS 取得、座標保存、輪替演算法、正式啟用條件） | PROPOSED（每項有建議，見 D-13） | D-13-v2 | Jerry | — | B-005、B-010、C-005、A-003-r2、J-003 |
| D-14a–b | 補助說明呈現細節（來源連結、非服務縣市） | PROPOSED（見 D-14） | D-14-v1 | Jerry | — | B-010、C-005 |

---

## 交付物核准矩陣

每一項 J-002 交付都分開列出規格核准、內容核准與正式發布，避免「合併了就算完成」。狀態依 2026-09-23 staging `8c59a99` 與 GitHub PR 紀錄。

| 交付 | 目前狀態 | 決策者／負責人 | 真實核准證據 | 可以開始的下游工作 | 仍受阻的驗收 |
|---|---|---|---|---|---|
| Assessment 方式（D-01） | SPEC-APPROVED | Jerry | PR #19 comment | B-010 依規則引擎實作 | 規則表逐條確認（D-01a）、PUBLISHED 知識 |
| 規則表＋補助說明模板（D-01a，r2） | PROPOSED | Jerry | — | B-010 實作與 §9 T1–T23 測試（規則表修改時同步調整）；C-005 依 Mock 排版 | B-010 正式驗收、J-003 真實 Assessment |
| Source Registry（D-02a） | PROPOSED；新北市來源 DATA-GAP | Jerry | — | B-009 依 registry 設計抓取清單；J-002 補新北市來源 | B-009 正式驗收；新北市地方知識 |
| 內容包格式與發布規則（D-03） | PROPOSED；**B-008 已合併（PR #26）** | Jerry | — | J-003 可在整合環境演練（不發布未核准內容） | 需補核准；若 Jerry 要求修改格式，另開 B-008 修正任務 |
| 首批知識內容（D-02） | 9 筆 APPROVED（2026-09-24）；目標版本 `KB-2026-09-24-001`；**尚未發布** | Jerry 審核 | 內容包逐筆 `review`；[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806103227) | J-003 首次知識發布；B-010 以明確標示的 fixture 測試 | 首次 PUBLISHED 版本、B-010 smoke、J-003 真實 Assessment |
| 地方補助知識（臺北市、新北市） | **缺內容**（目前只有臺北市照管中心聯絡資訊） | J-002 整理、Jerry 審核 | — | 結果頁先顯示 S-LOCAL-MISSING | 兩市地方補助的真實 E2E |
| Knowledge 正式發布 | 未發布（無 PUBLISHED 版本） | J-003 執行、Jerry 核准 | — | J-003 可執行 import → approve → publish（D-02 已核准） | 整合環境可用（D-09 Netlify 暫停；Supabase staging 需確認） |
| 每日知識更新（B-009） | 原始 MVP；未見提交 | B 實作 | PRODUCT_SPEC §42 | B-008 已合併，可開工 | 完整 MVP 驗收 |
| Session 安全 contract（D-04） | PROPOSED | Jerry | — | B-011a、B-010、B-005、B-006 依 v0.2 做可逆實作 | 核准前不得宣稱 session 安全驗收通過 |
| 隱私與同意版本（D-05），含位置告知草案 | PROPOSED；版本全部 DRAFT；法務 BLOCKED | Jerry＋法務 | — | C-005 可排版 DRAFT 文案與位置畫面；B-011a 依 ACTIVE 清單驗證版本 | 正式同意版本上線、正式啟用座標收集（D-13g）、J-004 |
| Lead 接件（D-06） | PROPOSED；接件人 BLOCKED | Jerry | — | B-006 依 LEAD_OPERATIONS 實作 API 與內部指令 | 真人接件演練、正式開放媒合 |
| 推薦排序（D-07） | 原始 MVP；座標 DATA-GAP | A／B／C／J | PRODUCT_SPEC §20–24 | B-005 全部分支；C-005 位置畫面；A-003-r2 座標 | 真實距離排序 E2E（需已驗證座標） |
| 位置細節（D-13a–g） | PROPOSED | Jerry | — | 依 API_CONTRACT v0.2.2 §8–§9 做可逆實作 | 核准前不得宣稱位置流程驗收通過 |
| 補助說明細節（D-14a–b） | PROPOSED | Jerry | — | 依建議實作（不新增欄位） | — |
| 原子寫入（D-10） | SPEC-APPROVED（僅 Provider 匯入） | Jerry | PR #16 comment | B-004 已合併 | staging Supabase 回滾測試（J-003）；B-008 沿用需補核准 |

---
## D-01 Assessment 判斷方式（SPEC-APPROVED）

### 決定（2026-09-23，Jerry）

**採方案 B：MVP 不使用 AI／LLM，以確定性規則引擎產生初步評估。** 理由：避免 AI token 費用。

規則、關鍵字、排序與摘要模板：`docs/ASSESSMENT_RULES.md`（目前 `RULES-2026-09-23-r2`，含補助說明模板；規則內容本身仍待 Jerry 逐條確認，D-01a）。

### 影響

| 項目 | 結果 |
|---|---|
| AI 費用 | 0 |
| API 格式 | 不變（`careNeeds`、`priority`、`summary`、`warnings`）；r2 起 `summary` 以 `\n` 分段（API_CONTRACT v0.2.2 §8），前端逐行顯示（C-005） |
| 可測試性 | 同輸入同輸出；ASSESSMENT_RULES §9 列出必要測試 |
| 隱私 | 評估資料不送外部服務；PRIVACY_AND_RETENTION §5 已改寫，L-2 不再適用 |
| 規格 | PRODUCT_SPEC §16、ARCHITECTURE §8／§19 已修訂 |
| 自由文字 | 只做 server 端關鍵字比對，補充使用者回答「不確定」的項目 |
| 已知限制 | 關鍵字會有漏判與誤判，所以只作為補充；結果頁一律使用「可能需要」 |
| B-010 | 改為實作規則引擎（見 `tasks/TASK-B-010.md`） |

### 曾考慮但未採用：方案 A（Claude API）

單次評估估計 US$0.01–0.06（視模型而定），並有境外處理健康資料的隱私問題。未來若要引入 AI，需重新決策並修訂 PRODUCT_SPEC §16。

---

## D-02 首批知識內容

- 來源登錄：`docs/knowledge/source-registry.md`（D-02a，PROPOSED）
- 內容包：`contracts/knowledge/packs/KP-2026-09-23-001.json`（9 筆）。**2026-09-24 Jerry 全部核准**：9 筆 `status = APPROVED`，逐筆 `review` 記錄審核人、時間與註記；目標版本 `intendedKnowledgeVersion = KB-2026-09-24-001`。
- 審核前已對照 2026-09-24 官方原文逐條／逐格比對，文字與數字一致。審核註記：KR-2026-005／006 核准時未另行核對 2025-10-03 勘誤函（PDF 與擷取版相同）；KR-2026-004 未收錄附表二「第一組／第二組擇一申請」規則，待下一批補充；KR-2026-001 `requiresDisability` 欄位名稱待修正。
- **內容核准 ≠ 已發布**：資料庫中仍沒有 PUBLISHED 版本，需由 J-003 經 B-008 import → approve → publish 建立。
- PR #19 合併**不是**內容審核。需要 Jerry 逐筆核准或退回，並在 PR 留下審核紀錄；核准後由 J-003 經 B-008 流程在整合環境實際發布。
- 在出現第一個 PUBLISHED 版本前，正式 Assessment 必須回 `KNOWLEDGE_UNAVAILABLE`，不得以 NEEDS_REVIEW 內容代替。

## D-03 內容包格式與發布規則

見 `contracts/knowledge/README.md` 與 `contracts/knowledge/content-pack.schema.json`。狀態 PROPOSED。B-008（PR #26）已於 2026-09-23 合併，但 PR 上沒有 D-03 的核准紀錄；合併不等於核准。請 Jerry 補核准（集中清單 #2），或指出要修改的格式，由 J-002 更新規格並另開 B-008 修正任務。

## D-04 Session 安全

見 `docs/ARCHITECTURE.md` §20、`docs/DATA_MODEL.md` §4／§6／§22、`docs/API_CONTRACT.md` §3.1–3.4。

狀態 PROPOSED。為了不讓安全防護拖到最後才做（見 TASK-B-011「B-011a／B-011b」）：

- B-011a（session token、歸屬檢查、錯誤碼）建議**優先核准**，B-010／B-005／B-006 開發時直接使用。
- 核准前，B 依 v0.2 實作屬可逆準備；若提案修改，由 J-002 更新 contract 並通知 B。

## D-05 隱私與保存

見 `docs/PRIVACY_AND_RETENTION.md`。所有文案版本在法務確認前都是 `DRAFT`，不得作為正式同意版本上線。

## D-06 Lead 接件

見 `docs/LEAD_OPERATIONS.md`。**接件人姓名、備援人與服務時段必須由 Jerry 指定真人並取得本人同意**；未指定前，J-004 不開放正式媒合。

## D-07 推薦排序（原始 MVP；座標為資料缺口）

原始要求（PRODUCT_SPEC §20–24，**不變**）與目前可實作範圍：

| 使用者位置 | 行為 | 不得 |
|---|---|---|
| GPS／經緯度／可定位完整地址 | 服務類型 → 服務範圍 → **距離** → Top 3，推薦原因可含「距離約 X 公里」 | 用沒有驗證的座標算距離 |
| 只有行政區 | 服務類型 → 服務範圍 → **穩定輪替**（seed：sessionId＋district＋date） → Top 3 | 宣稱「距離最近」；純 Random |
| 沒有位置 | 仍可完成 Assessment、Care Need Profile 與服務建議；提醒提供縣市／行政區 | 宣稱「附近商家」 |

資料事實：A-003（PR #13）與 staging `data/providers/staging/providers.json` 目前 0／30 筆 Provider 有已驗證座標。這是**資料缺口**，由 A-003-r2 補齊；不是產品決策。

整併後的完整規格（位置精度、必填欄位、排序、回應欄位）：API_CONTRACT v0.2.2 §8–§9、DATA_MODEL §7／§9／§17／§20、PRIVACY_AND_RETENTION §2／§8。承接：

| 負責 | 工作 | 驗收 |
|---|---|---|
| A-003-r2 | 可追溯的已驗證 Provider 座標與覆蓋率報告 | 報告列來源、驗證方式、日期與覆蓋率；A-004 驗證通過 |
| B-010 | Assessment 依 precision 驗證 `location`；`NONE`／`CITY` 可完成評估 | API 測試（每種 precision 的合法與非法組合） |
| B-005 | 全部 rankingType 分支 | 合成座標單元測試＋真實資料 smoke |
| C-005 | 三種位置情境的輸入介面、GPS 拒絕／失敗備援、各 rankingType 畫面 | Mock 模組驗收 |
| J-002 | 位置用途、保存與同意告知草案（PRIVACY §2、§8） | 法務確認後成為 ACTIVE 版本（D-05） |
| J-003 | 三種位置情境與邊界的真實 E2E | INTEGRATION_ACCEPTANCE 紀錄 |

## D-08 MVP 不收集 GPS（SHELVED，未核准）

- 歷史提案（J-002-r3）：MVP 只收縣市＋行政區，不收 GPS 或完整地址。
- **狀態：未核准、已擱置。** 精確位置屬原始 MVP（PRODUCT_SPEC §21），依原始範圍開發：A-003-r2 補座標、C-005 做位置取得與拒絕備援、J-002 提供告知草案。正式收集仍需 ACTIVE 同意版本（D-13g）。
- 若日後要縮減，須依 PRODUCT_SPEC §58 重新提出並修訂 §21／§54。

## D-11 crawler 延後（SHELVED，未核准）

- 歷史提案（J-002-r3）：MVP 先人工每日檢查官方來源，crawler 延至 MVP 後。
- **狀態：未核准、已擱置。** B-009 每日 00:10（Asia/Taipei）自動檢查 → KnowledgeChange → 人工審核 → 發布，依原始 MVP 開發並列入 J-003／J-004 必要驗收。

## D-12 結果頁不顯示給付金額（SHELVED，未核准）

- 歷史提案：ASSESSMENT_RULES r1 §6 最後一點「MVP 不在結果頁顯示給付金額或部分負擔比率」。
- **狀態：未核准、已擱置。** 該限制已自 ASSESSMENT_RULES 移除；補助說明依原始 MVP（PRODUCT_SPEC §1、§3、§14），模板與知識對應見 ASSESSMENT_RULES §6.3–§6.4（D-01a r2）。
- 呈現原則（整併自原始 MVP 與 AGENTS §14–15，不需另行核准）：只列可能適用的補助類別、條件、官方規則說明、來源與知識版本；金額／比率只在 PUBLISHED 紀錄有依據時以「官方規則上限／範圍」呈現；不計算個人核定額度、不做補助計算器、不宣稱核定；政策數值只來自 PUBLISHED Knowledge；未確認內容維持 NEEDS_REVIEW；臺北市、新北市地方制度分開，缺少時引導洽 1966／照管中心。
- 承接：J-002（模板、內容對應、contract，本版完成）→ B-010（依規則與 PUBLISHED 知識產生 summary）→ C-005（結果頁逐行顯示、顯示知識版本）→ J-003（真實環境驗收：臺北市、新北市各一例＋知識缺漏）。

## D-13 位置流程細節（PROPOSED，待 Jerry 決定）

原始規格已有結論的部分已直接整併（見 D-07）。下列是原始規格**沒有**決定的細節。每項都有建議與契約範例（API_CONTRACT v0.2.2 §8–§9、`contracts/mock/recommendations/ranking-variants/`）；核准前 B／C 依建議做可逆實作，不得宣稱驗收通過。

| ID | 問題 | 建議 | 理由 |
|---|---|---|---|
| D-13a | 只有縣市時的推薦 | `CITY_ROTATION`：服務範圍含該縣市任一行政區的 Provider，穩定輪替（seed 不含行政區）；notice 說明非依距離、不代表能服務所在行政區，建議補行政區 | §24 要求提醒提供「縣市／行政區」，代表只有縣市也應可取得推薦；DATA_MODEL 與前端型別已有此值，不需新增 enum |
| D-13b | 沒有位置時是否呼叫推薦 API | 前端不呼叫，直接顯示服務建議與「補充位置」入口（回到評估頁位置欄位重新送出，建立新 Assessment）；API 被呼叫時回 `NO_LOCATION`、空陣列與提醒 | 符合 §24 不宣稱附近；不需新增 API 或欄位 |
| D-13c | 精確位置但候選 Provider 部分或全部缺座標 | 只要有任一候選缺已驗證座標，整批改 `DISTRICT_ROTATION`，`locationPrecision` 仍回 `GPS`／`EXACT`，notice 說明原因；不混排 | 避免缺座標的單位被排在後面或被誤認為較遠；排序可預測、容易驗收；座標覆蓋率提升後自動回到 DISTANCE |
| D-13d | 如何取得精確位置 | MVP 以瀏覽器定位（`GPS`）完成精確位置流程；縣市與行政區仍由使用者選擇（用於服務範圍比對，不做反向地理編碼）。完整地址轉座標（`EXACT`）需地理編碼服務，屬費用／授權決策：**建議先不接**，contract 保留 `EXACT`，Jerry 選定免費或官方服務後由 B／C 承接 | 瀏覽器定位免費、不需第三方；避免新增付費服務；不刪除原始規格的 EXACT |
| D-13e | 座標保存 | 寫入 Assessment 前四捨五入到小數 3 位（約 100 公尺）；隨 session 90 天刪除；不入 log、不複製到 Lead、不提供給服務單位 | DATA_MODEL 原本就在 Assessment 存 lat／lng（推薦 API 只帶 assessmentId）；約略化降低敏感度，對公里級距離影響小 |
| D-13f | 穩定輪替與距離同分規則 | 輪替：`sha256(sessionId\|city\|district\|date\|providerId)` 升冪，date 為 Asia/Taipei；距離同分依 providerId 升冪；`distanceKm` 四捨五入到小數 1 位，notice 註明直線距離 | 可重現、可測試，同日穩定、跨日輪替，符合 §23 |
| D-13g | 正式環境何時可收集座標 | 同意版本（含 PRIVACY §8「位置資訊」段落）成為 ACTIVE 前，正式環境不顯示「使用目前位置」；建議以部署設定開關（預設關閉）控制，由 C-005 實作開關判斷、J-003 設定 | 避免在告知文案未確認前收集精確位置，同時不阻擋開發與 Mock 驗收 |

GPS 拒絕或失敗：顯示原因並回到縣市／行政區選擇；使用者可選「不提供位置」繼續。評估不因定位失敗中斷（整併自 §24，不需另行決定）。

## D-14 補助說明呈現細節（PROPOSED，待 Jerry 決定）

| ID | 問題 | 建議 | 理由 |
|---|---|---|---|
| D-14a | 結果頁是否提供官方來源連結 | MVP 不新增 API 欄位；來源以文字呈現（機關、標題、生效日、知識版本，S-SUB-SOURCE）。若需可點擊連結，日後以 `knowledgeReferences[]`（recordId、title、sourceUrl、effectiveFrom）作為選填欄位新增，需另開 contract 變更 | 既有 `summary`＋`knowledgeVersion` 已能呈現來源與版本；避免為整併任意新增欄位 |
| D-14b | 臺北市、新北市以外的使用者 | 評估頁縣市選項為臺北市、新北市與「其他縣市／不提供」；後者以 `NONE` 送出，可完成評估與中央制度說明，顯示 S-LOCAL-NOCITY，不推薦 Provider | MVP 服務地區為臺北市、新北市（§7）；不新增 enum 或縣市清單 |

---

## D-09 Netlify 部署與額度（2026-09-23 實查）

實查結果（Netlify 後台，viz963's team）：

- 團隊已超出 credit 上限，**所有專案（`kareo-tw` 與 `kareocar`）皆已暫停**；下個計費週期（2026-09-29 之後）才會自動恢復，或需購買額度。
- 本期用量 1,038.8 credits，其中 **Production deploys 68 次 = 1,020 credits**（每次約 15 credits），流量與運算僅約 19 credits。
- `kareo-tw` 的 production branch 為 `staging`，所以**每次合併到 staging 都算一次 production deploy**。
- 團隊已排程在 7 天內降級為 Free 方案。
- 自動加值：未啟用（本任務不啟用）。

影響：

- Kareocar 外連目標 `https://kareocar.netlify.app/` 目前也在暫停中，交通 CTA 會連到無法使用的頁面。
- 降級為 Free 後，若額度仍依部署次數計算，每月可部署次數會大幅減少。實際 Free 方案額度以 Netlify 當時的方案頁為準。

建議（已在 J-003 以 repo 設定落實可逆的部分）：

1. `netlify.toml` 加入 `ignore` 規則：只有**確定不影響部署結果**的文件變更才不觸發建置；被前端／Functions 程式引用的 contract、資料檔變更必須建置（規則見 `docs/DEPLOYMENT.md`，J-003-r2 修正）。
2. Jerry 集中合併、減少 staging 部署次數；E2E 驗收期間約定部署時段。
3. 需要 Jerry 決定：是否在 9/29 前購買額度、是否取消降級、Kareocar 是否需要先恢復。這些都是付費決策，本任務不代為操作。

## D-10 多表原子寫入（2026-09-23，Jerry）

PR #16（B-004）review P1：三張 Provider 表依序寫入，失敗時會留下半套資料。B 提出三個方案：

| 方案 | 做法 | 結果 |
|---|---|---|
| **A** | Postgres function 單一交易寫入三表，Node 驗證完只呼叫一次 rpc | **採用** |
| B | Node 以 `pg` 直連並自行開交易 | 不採用：多一個套件與資料庫連線密鑰 |
| C | 暫存表後一次發布 | 不採用：schema 變動最大 |

規則見 ARCHITECTURE §22。不採用「失敗時程式手動補償刪除」，因為那不是原子操作。



### D-10 延伸使用（待核准）

B-008（PR #26，**已於 2026-09-23 合併**）的 `publish_knowledge_version`／`withdraw_knowledge_version` 沿用 D-10 模式。依 ARCHITECTURE §22 第 6 點，其他用途需 Jerry 另行核准並登記於此；目前**沒有核准紀錄**（PR #26 沒有 review 或 comment）。建議核准（理由：發布／撤回同時改兩張表，需要全有或全無），核准後在此補證據連結。

---

## 待 Jerry 決定（集中清單）

只列真正需要 Jerry 決定的事項，依對「真實使用者流程跑通」的影響排序。每項都附建議；決定後請在對應 PR 留言，J-002 再把連結填入「核准證據」。

| # | 事項 | 建議 | 若未決定的影響 |
|---|---|---|---|
| 1 | D-03 內容包格式、D-10 延伸使用（B-008 已合併） | 補核准現行格式與發布／撤回函式（兩者都需全有或全無） | B-008 目前處於「已合併但未核准」；若要改格式需另開修正任務 |
| 2 | D-04 Session 安全 contract | 依 API_CONTRACT v0.2 §3 核准 | B-011a／B-010／B-005／B-006 只能做可逆實作 |
| 3 | D-01a 規則表 r2（含補助說明模板、顯示文字對照、HOME_MEDICAL_NURSING → 照顧及專業服務的對應） | 逐條確認；HOME_MEDICAL_NURSING 對應建議保留（專業服務涵蓋居家護理類服務），若不同意則只顯示於 HOME_CARE | B-010 無法完成正式驗收 |
| 4 | D-13a–g 位置細節 | 採上表建議 | B-005、C-005 只能做可逆實作 |
| 5 | D-14a–b 補助呈現細節 | 採上表建議 | 同上 |
| 6 | 地方補助知識：臺北市、新北市的補助項目與新北市來源（D-02a DATA-GAP） | 指定 J-002 下一批內容包（KP-*-002）整理兩市地方補助與新北市照管中心資訊，列入 9/30 目標 | 結果頁只能顯示 S-LOCAL-MISSING；「台北市補助不套用新北市」只能以缺漏案例驗收 |
| 7 | D-05 法務（L-1～L-6）與客服信箱 | 優先確認 L-6（位置）與 L-1（健康資料） | 同意版本維持 DRAFT，無法正式上線、無法正式收集座標 |
| 8 | D-06 接件人與備援人 | 指定真人並取得同意 | 無法開放正式媒合 |
| 9 | D-09 Netlify 額度 | 決定是否在 9/29 前購買額度或維持集中合併 | 部署後 E2E 無法執行 |
