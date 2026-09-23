# Kareo MVP Decisions / MVP 決策紀錄

Submission Version: J-002-r3
Owner: Jerry
Last reviewed: 2026-09-23

本文件記錄 2026-10-22 MVP 所需決策與每項交付的核准狀態。

**最高產品依據**：`docs/PRODUCT_SPEC.md` 的原始 MVP，加上 Jerry 明確核准並留下證據的變更（本文件狀態為 `APPROVED` 的項目）。TASK、決策提案、資料不足或程式暫時做不到，都**不會**縮減原始 MVP 範圍。要縮減範圍，必須在本文件登記為「範圍變更提案」，經 Jerry 核准後修訂 PRODUCT_SPEC（§58 Change Rule）。

---

## 狀態定義

一項交付可能同時處於不同層級的狀態，必須分開記錄，不得互相代替：

| 層級 | 狀態 | 意義 | 誰能改 |
|---|---|---|---|
| 決策／規格 | `PROPOSED` | 已有具體方案，**等待 Jerry 核准**。下游只能做「可逆」的準備（可隨提案修改而改寫），不得當作定案，不得據此宣稱驗收通過 | J-002 |
| 決策／規格 | `SPEC-APPROVED` | Jerry 已留下核准紀錄（連結填於「核准證據」）。下游可依此實作與驗收 | Jerry |
| 範圍變更 | `CHANGE-PROPOSED` | 會縮減或改變原始 MVP 的提案。**核准前原始 MVP 要求維持不變**，工程師依原始要求工作 | J-002 提出、Jerry 決定 |
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
| D-01a | 規則表、關鍵字、Summary 模板 `RULES-2026-09-23-r1` | PROPOSED（逐條待確認） | r1 | Jerry | — | B-010 |
| D-02 | 首批知識內容包 `KP-2026-09-23-001`（9 筆） | 內容 **NEEDS_REVIEW**（0 筆核准） | D-02-v1 | Jerry（審核人） | — | J-003 首次發布、B-010 |
| D-02a | 官方來源白名單與 Source Registry `SR-2026-09-23-01` | PROPOSED | D-02a-v1 | Jerry | — | B-008、B-009 |
| D-03 | 知識內容包格式、匯入驗證、發布／撤回規則 | PROPOSED | D-03-v1 | Jerry | — | B-008 |
| D-04 | 匿名 session 持有證明、有效期、資源歸屬、濫用限制、冪等、刪除（API_CONTRACT v0.2 §3） | PROPOSED | D-04-v1 | Jerry | — | B-011a、B-005、B-006、J-003 adapter |
| D-05 | 隱私、同意版本、保存／刪除、外部資料流 | PROPOSED；法務 **BLOCKED** | D-05-v1 | Jerry | — | B-011、C-005、J-004 |
| D-06 | Lead 接件方式、角色、狀態轉移、回覆時程 | PROPOSED；接件人 **BLOCKED** | D-06-v1 | Jerry | — | B-006、J-004 |
| D-07 | 推薦排序：有精確位置依距離、只有行政區穩定輪替、無位置不宣稱附近（PRODUCT_SPEC §21–24） | **原始 MVP 要求（不變）**；Provider 座標 **DATA-GAP** | D-07-v2 | Jerry | PRODUCT_SPEC §21–24 | A-003 補充、B-005、C-003、C-005、J-003 |
| D-08 | MVP 不收集 GPS | **CHANGE-PROPOSED（未核准）** | D-08-v2 | Jerry | — | 核准前不影響任何任務 |
| D-09 | Netlify 部署額度與部署觸發策略 | PROPOSED；額度 **BLOCKED** | D-09-v1 | Jerry | — | J-003、J-004 |
| D-10 | 多表原子寫入方式（B-004 Provider 匯入） | **SPEC-APPROVED：方案 A，Postgres function 單一交易** | D-10-v1 | Jerry | [PR #16 comment 2026-09-23](https://github.com/viz963-1216/Kareo/pull/16#issuecomment-5788552476) | B-004、J-003（B-008 沿用需另行核准，見 D-10 末段） |
| D-11 | 每日官方知識更新（PRODUCT_SPEC §42）：crawler 延後、MVP 先人工每日檢查 | **CHANGE-PROPOSED（未核准）**；核准前 B-009 屬原始 MVP | D-11-v1 | Jerry | — | B-009、J-003、J-004 |
| D-12 | 結果頁不顯示給付金額／部分負擔（ASSESSMENT_RULES §6 最後一點） | **CHANGE-PROPOSED（未核准）**；原始 MVP 要求「補助初步預估」 | D-12-v1 | Jerry | — | B-010、C-002 |
| D-13 | 沒有位置／只有縣市時的推薦回應（contract 未定義） | PROPOSED（規格缺口） | D-13-v1 | Jerry | — | B-005、C-003 |

---

## 交付物核准矩陣

每一項 J-002 交付都分開列出規格核准、內容核准與正式發布，避免「合併了就算完成」。

| 交付 | 目前狀態 | 決策者／負責人 | 真實核准證據 | 可以開始的下游工作 | 仍受阻的驗收 |
|---|---|---|---|---|---|
| Assessment 方式（D-01） | SPEC-APPROVED | Jerry | PR #19 comment | B-010 依規則引擎實作 | 規則表逐條確認（D-01a）、PUBLISHED 知識 |
| 規則表（D-01a） | PROPOSED | Jerry | — | B-010 實作與 13 個測試案例（規則表修改時同步調整） | B-010 正式驗收、J-003 真實 Assessment |
| Source Registry（D-02a） | PROPOSED | Jerry | — | B-008 讀取 registry 驗證 sourceId；B-009 設計抓取清單 | B-008／B-009 合併前需 SPEC-APPROVED；新北市來源擷取失敗待補 |
| 內容包格式與發布規則（D-03） | PROPOSED | Jerry | — | B-008 實作（PR #26 已送審） | **B-008 合併需先 SPEC-APPROVED**，否則格式變動會讓 B-008 重做 |
| 首批知識內容（D-02） | 9 筆 NEEDS_REVIEW，0 筆 APPROVED | Jerry 審核 | — | B-008 可用此包做匯入測試（結果一律 NEEDS_REVIEW） | 首次 PUBLISHED 版本、B-010 smoke、J-003 真實 Assessment |
| Knowledge 正式發布 | 未發布（無 PUBLISHED 版本） | J-003 執行、Jerry 核准 | — | — | 需 D-02 內容核准＋B-008 合併＋整合環境 |
| 每日知識更新（B-009） | 原始 MVP；延後提案 D-11 未核准 | B 實作、Jerry 決策 | — | B-008 合併後即可開工 | 完整 MVP 驗收 |
| Session 安全 contract（D-04） | PROPOSED | Jerry | — | B-011a、B-005、B-006 依 v0.2 做可逆實作；J-003 adapter | 核准前不得宣稱 session 安全驗收通過 |
| 隱私與同意版本（D-05） | PROPOSED；版本全部 DRAFT；法務 BLOCKED | Jerry＋法務 | — | C-005 可排版 DRAFT 文案；B-011 依 ACTIVE 清單驗證版本 | 正式同意版本上線、J-004 |
| Lead 接件（D-06） | PROPOSED；接件人 BLOCKED | Jerry | — | B-006 依 LEAD_OPERATIONS 實作 API 與內部指令 | 真人接件演練、正式開放媒合 |
| 推薦排序（D-07） | 原始 MVP；座標 DATA-GAP | A／B／C／J | PRODUCT_SPEC §21–24 | B-005 兩個分支都實作；C 兩種畫面；A 補座標 | 真實距離排序 E2E（需已驗證座標） |
| 原子寫入（D-10） | SPEC-APPROVED（僅 Provider 匯入） | Jerry | PR #16 comment | B-004 r2（已送審） | staging Supabase 回滾測試（J-003）；B-008 知識發布／撤回沿用此模式需 Jerry 另行核准（ARCHITECTURE §22 第 6 點） |

---
## D-01 Assessment 判斷方式（SPEC-APPROVED）

### 決定（2026-09-23，Jerry）

**採方案 B：MVP 不使用 AI／LLM，以確定性規則引擎產生初步評估。** 理由：避免 AI token 費用。

規則、關鍵字、排序與摘要模板：`docs/ASSESSMENT_RULES.md`（`RULES-2026-09-23-r1`，規則內容本身仍待 Jerry 逐條確認）。

### 影響

| 項目 | 結果 |
|---|---|
| AI 費用 | 0 |
| API 格式 | 不變（`careNeeds`、`priority`、`summary`、`warnings`），前端不需修改 |
| 可測試性 | 同輸入同輸出；ASSESSMENT_RULES §9 列出必要測試 |
| 隱私 | 評估資料不送外部服務；PRIVACY_AND_RETENTION §5 已改寫，L-2 不再適用 |
| 規格 | PRODUCT_SPEC §16、ARCHITECTURE §8／§19 已修訂 |
| 自由文字 | 只做 server 端關鍵字比對，補充使用者回答「不確定」的項目 |
| 已知限制 | 關鍵字會有漏判與誤判，所以只作為補充；結果頁一律使用「可能需要」 |
| B-010 | 改為實作規則引擎（見 `tasks/TASK-B-010.md`） |

### 曾考慮但未採用：方案 A（Claude API）

單次評估估計 US$0.01–0.06（視模型而定），並有境外處理健康資料的隱私問題。未來若要引入 AI，需重新決策並修訂 PRODUCT_SPEC §16。

---


---

## D-02 首批知識內容

- 來源登錄：`docs/knowledge/source-registry.md`（D-02a，PROPOSED）
- 內容包：`contracts/knowledge/packs/KP-2026-09-23-001.json`（9 筆，全部 `NEEDS_REVIEW`，`review.reviewedBy = null`）
- PR #19 合併**不是**內容審核。需要 Jerry 逐筆核准或退回，並在 PR 留下審核紀錄；核准後由 J-003 經 B-008 流程在整合環境實際發布。
- 在出現第一個 PUBLISHED 版本前，正式 Assessment 必須回 `KNOWLEDGE_UNAVAILABLE`，不得以 NEEDS_REVIEW 內容代替。

## D-03 內容包格式與發布規則

見 `contracts/knowledge/README.md` 與 `contracts/knowledge/content-pack.schema.json`。狀態 PROPOSED：B-008（PR #26）可依此開發，但合併前需要 Jerry 核准格式，避免雙方各自改動。

## D-04 Session 安全

見 `docs/ARCHITECTURE.md` §20、`docs/DATA_MODEL.md` §4／§6／§22、`docs/API_CONTRACT.md` §3.1–3.4。

狀態 PROPOSED。為了不讓安全防護拖到最後才做（見 tasks/README「B-011 分段」）：

- B-011a（session token、歸屬檢查、錯誤碼）建議**優先核准**，B-005／B-006 開發時直接使用。
- 核准前，B 依 v0.2 實作屬可逆準備；若提案修改，由 J-002 更新 contract 並通知 B。

## D-05 隱私與保存

見 `docs/PRIVACY_AND_RETENTION.md`。所有文案版本在法務確認前都是 `DRAFT`，不得作為正式同意版本上線。

## D-06 Lead 接件

見 `docs/LEAD_OPERATIONS.md`。**接件人姓名、備援人與服務時段必須由 Jerry 指定真人並取得本人同意**；未指定前，J-004 不開放正式媒合。

## D-07 推薦排序（原始 MVP 要求；座標為資料缺口）

原始要求（PRODUCT_SPEC §21–24，**不變**）：

| 使用者位置 | 行為 | 不得 |
|---|---|---|
| GPS／經緯度／可定位完整地址 | 服務類型 → 服務範圍 → **距離** → Top 3，推薦原因可含「距離約 X 公里」 | 用沒有驗證的座標算距離 |
| 只有行政區 | 服務類型 → 服務範圍 → **穩定輪替**（seed：sessionId＋district＋date） → Top 3 | 宣稱「距離最近」；純 Random |
| 沒有位置 | 仍可完成 Assessment、Care Need Profile 與服務建議；提醒提供縣市／行政區 | 宣稱「附近商家」 |

資料事實：A-003（PR #13）報告 30／30 筆 Provider 沒有可追溯的已驗證座標（刻意不猜）。這是**資料缺口**，不是產品決策；上一版把它寫成「DECIDED-BY-SPEC：MVP 只做行政區推薦」是錯的，本版更正。

### 目前可測試／可提供

- 行政區穩定輪替：資料（服務範圍 81 筆）足以測試，待 A-004 修正、B-004 匯入、B-005 實作。
- 距離分支的**程式邏輯**：可用合成座標的單元測試驗證（Haversine、排序、推薦原因、無座標 Provider 的處理）。
- 無位置路徑：Assessment 與服務建議可完成（C-002 已有畫面，需 B-010 真實 Assessment）。

### 完成原始 MVP 還缺

| 負責 | 應補工作 | 驗收 |
|---|---|---|
| A | 為 Provider 取得可追溯的已驗證座標（TASK-A-003 補充驗收）；無法驗證者保持 null 並列出 | 報告列出座標來源、驗證方式與覆蓋率；A-004 驗證座標範圍；不從地址猜 |
| B | B-005 同時實作 `DISTANCE` 與 `DISTRICT_ROTATION`，依「使用者位置精度＋Provider 是否有已驗證座標」選擇分支；Provider 缺座標時不得出現在距離排序的名次中冒充近距離（處理方式見 B-005 補充） | 合成座標單元測試；真實資料 smoke；reasons 只在有距離時寫距離 |
| C | 位置輸入支援精確位置、只有行政區與不提供位置三種情境；DISTANCE 與 DISTRICT_ROTATION 兩種結果畫面（C-003 已支援顯示，Mock 需保留 DISTANCE fixture） | Mock 模組驗收（C）＋真實 API 驗收（J-003） |
| J | 追蹤 D-08、D-13 決策；J-003 對三種位置情境做真實 E2E | INTEGRATION_ACCEPTANCE 記錄 |

GPS 收集需同步更新隱私告知與同意版本（D-05），所以 C 的 GPS 取得畫面要等 D-08 決議；在此之前 C 可先做不涉及收集的準備（位置精度狀態、結果畫面）。

## D-08 MVP 不收集 GPS（範圍變更提案，未核准）

- **狀態：CHANGE-PROPOSED。** 核准前，原始 MVP（PRODUCT_SPEC §21 支援 GPS／經緯度／完整地址）不變，工程師不得當作已定案。
- 提案內容：MVP 只收縣市＋行政區，不收 GPS 或完整地址。
- 理由：目前沒有已驗證 Provider 座標，收集精確位置暫時無法產生距離排序；符合資料最小化；免去 GPS 權限與精確位置的隱私告知。
- 影響（若核准）：PRODUCT_SPEC §21 在 MVP 不提供；「距離約 X 公里」不出現；A 補座標可延後；C 不需做 GPS；PRIVACY_AND_RETENTION 維持不收 GPS。需修訂 PRODUCT_SPEC §21 與 §54。
- 影響（若不核准）：A 補座標、C 做 GPS／地址輸入、隱私文案加入 GPS 用途與保存期限、同意版本更新；J-003 驗證 GPS 拒絕後回到行政區路徑。
- 替代方案：收「可定位完整地址」而不收 GPS（仍需 A 座標與隱私文案）。

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


## D-11 每日官方知識更新（範圍變更提案，未核准）

- **原始 MVP（PRODUCT_SPEC §42–43）**：每天 00:10（Asia/Taipei）自動抓取官方來源 → Snapshot → Hash → 比對 → KnowledgeChange → 人工審核 → 發布。對應 TASK-B-009，**屬原始 MVP**。
- 上一版把 B-009 寫成「MVP 後／可後補」，與 PRODUCT_SPEC 不一致，本版更正：B-009 列入 MVP 依賴與驗收（見 tasks/README）。
- **提案（CHANGE-PROPOSED）**：MVP 先以人工每日檢查官方來源（依 Source Registry 逐站比對並記錄），crawler 延至 MVP 後。
  - 理由：B 的排程已滿（B-004、B-008、B-005、B-006、B-010、B-011）；知識內容量小（9 筆），人工可行。
  - 影響：需指定每日檢查人與紀錄格式；PRODUCT_SPEC §42 需修訂；MVP 驗收時「每日自動更新」項目改為「人工每日檢查紀錄」；10/22 交付說明不得宣稱已有自動更新。
  - 核准前：B-009 維持 MVP 必要項目，J-003 release gate 將其列為必要項；不得宣布原始 MVP 已完成。

## D-12 結果頁不顯示給付金額／部分負擔（範圍變更提案，未核准）

- 原始 MVP（PRODUCT_SPEC §1、§3、§14）包含「了解可能適用的制度與補助」「補助初步預估」。
- `ASSESSMENT_RULES.md` §6 最後一點「MVP 不在結果頁顯示給付金額或部分負擔比率」屬縮減，目前只是規則表提案（D-01a）的一部分，**未核准**。
- 目前規則模板涵蓋：可能資格（S-ELIG-*）、交通用途（S-TR）、下一步（S-NEXT）；**沒有**補助類別或補助說明模板。這是原始需求缺少承接的項目，已在 `docs/MVP_TRACEABILITY.md` 標為缺口並指到 B-010（規則模板實作）與 C-002（結果頁）。
- 需要 Jerry 決定：
  - 方案 A（符合原始 MVP）：依 PUBLISHED 知識顯示可能適用的補助類別與官方規則說明（含金額時標註「依官方公告，實際以照管專員核定為準」）。
  - 方案 B（縮減，需修訂 PRODUCT_SPEC）：只列補助類別與申請管道，不顯示金額與比率。

## D-13 沒有位置／只有縣市時的推薦回應（規格缺口）

- PRODUCT_SPEC §24 要求無位置時不宣稱附近商家、提醒提供縣市／行政區；API_CONTRACT §9 只定義 DISTANCE、DISTRICT_ROTATION 與空結果，沒有定義 `NO_LOCATION`／`CITY_ROTATION` 的回應，但前端型別已有這兩個值。
- 提案：
  - 只有縣市：`rankingType = CITY_ROTATION`，依服務範圍涵蓋該縣市的 Provider 穩定輪替，notice 說明非依距離、建議補行政區。
  - 沒有位置：前端不呼叫推薦 API，改顯示服務建議與「提供縣市／行政區後可取得推薦」；若呼叫，API 回 `rankingType = NO_LOCATION`、`providers = []` 與提醒 notice。
- 核准後由 J-002 更新 API_CONTRACT §9，B-005／C-003 依此實作。核准前 B-005 對這兩種情況回空結果＋提醒，不得回「附近」字樣。

### D-10 延伸使用（待核准）

B-008（PR #26）的 `publish_knowledge_version`／`withdraw_knowledge_version` 沿用 D-10 模式。依 ARCHITECTURE §22 第 6 點，其他用途需 Jerry 另行核准並登記於此；目前**未核准**。建議核准（理由：發布／撤回同時改兩張表，需要全有或全無），核准後在此補證據連結。
