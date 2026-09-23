# Kareo MVP Decisions / MVP 決策紀錄

Submission Version: J-002-r1
Owner: Jerry
Last reviewed: 2026-09-23

本文件逐項記錄 2026-10-22 MVP 所需決策。每一項都有 decision owner、狀態、版本與下游任務。

狀態定義：

| 狀態 | 意義 |
|---|---|
| `PROPOSED` | 已有具體方案，**等待 Jerry 核准**；下游任務只能依方案做「可逆」的準備，不得視為定案 |
| `APPROVED` | Jerry 已在 PR / Issue 留下核准紀錄（連結填於「核准證據」） |
| `DECIDED-BY-SPEC` | 由現有高順位規格或已驗證事實直接決定，不需另行選擇 |
| `BLOCKED` | 缺外部輸入（人、帳號、法務），不得以假設解鎖 |

> 本文件不代表任何外部服務已購買、任何人已同意擔任接件人、或任何法務意見已取得。
> 「核准證據」欄位只能填真實連結；空白代表尚未核准。

---

## 決策總表

| ID | 決策 | 狀態 | 版本 | Decision owner | 核准證據 | 下游任務 |
|---|---|---|---|---|---|---|
| D-01 | Assessment AI 供應商／模型／費用上限／失敗行為 | PROPOSED | D-01-v1 | Jerry | — | B-010、J-003、J-004 |
| D-02 | 知識來源白名單與首批內容包 `KP-2026-09-23-001` | PROPOSED（內容待逐筆審核） | D-02-v1 | Jerry（審核人） | — | B-008、J-003 首次發布、B-010 |
| D-03 | 知識內容包格式、匯入驗證、發布／撤回規則 | PROPOSED | D-03-v1 | Jerry | — | B-008 |
| D-04 | 匿名 session 持有證明、有效期、資源歸屬、濫用限制、冪等、刪除 | PROPOSED | D-04-v1 | Jerry | — | B-011、B-006、B-005、J-003 adapter |
| D-05 | 隱私、同意版本、保存／刪除、委外 AI 資料流 | PROPOSED（法務待確認） | D-05-v1 | Jerry | — | B-011、C-005、J-004 |
| D-06 | Lead 接件方式、角色、狀態轉移、回覆時程 | PROPOSED；接件人 **BLOCKED** | D-06-v1 | Jerry | — | B-006、J-004 |
| D-07 | MVP 推薦排序只使用行政區輪替（無距離排序） | DECIDED-BY-SPEC＋資料事實 | D-07-v1 | Jerry | A-003 報告：30/30 Provider 無已驗證座標 | B-005、C-003 |
| D-08 | MVP 不收集 GPS | PROPOSED | D-08-v1 | Jerry | — | C、B-011、隱私文件 |
| D-09 | Netlify 部署額度與部署觸發策略 | PROPOSED；額度 **BLOCKED** | D-09-v1 | Jerry | — | J-003、J-004 |

---

## D-01 Assessment AI 方案

### 現況（已驗證）

- `apps/api/src/functions/assessment.ts` 目前使用 `FakeAssessmentAIAdapter`＋`NullKnowledgeVersionResolver`，正式 Assessment 一律回 `KNOWLEDGE_UNAVAILABLE`（刻意的安全行為）。
- ARCHITECTURE §19：AI Provider 尚未鎖定，必須經 Adapter 隔離。

### 方案 A（建議）：Anthropic Claude API，規則先行＋模型生成摘要

責任切分（降低模型可犯錯的範圍）：

| 步驟 | 誰做 | 說明 |
|---|---|---|
| 1. `careNeeds` 基線 | **確定性規則**（B-010 實作於 server） | `needs.*` 回答 `YES` 的項目一定列入；模型不得移除 |
| 2. `priority` 排序與可能補列 | 模型提出 → server 驗證 | 模型只能在 4 個 enum 內排序；補列 `UNKNOWN` 項目時需附理由，server 驗證 enum 與去重 |
| 3. `summary` | 模型 | 只能引用本次請求附上的 PUBLISHED 知識摘錄；必須使用「初步預估／可能」語氣 |
| 4. `warnings` | **server 固定文字** | 依 API_CONTRACT §15，由程式附加，不交給模型生成 |
| 5. Provider | **不交給模型** | 推薦只由 Recommendation Engine（B-005）確定性處理 |

模型選項（價格為 Anthropic 第一方 API 牌價，每百萬 token，2026-09 查詢；上線前請於 Console 再次確認）：

| 模型 ID | 輸入 | 輸出 | 單次評估估算* | 1,000 次／月 |
|---|---|---|---|---|
| `claude-opus-5`（預設建議） | US$5 | US$25 | 約 US$0.03–0.06 | 約 US$30–60 |
| `claude-sonnet-5` | US$2 | US$10 | 約 US$0.01–0.03 | 約 US$13–30 |
| `claude-haiku-4-5` | US$1 | US$5 | 約 US$0.01 | 約 US$7–10 |

\* 估算假設：輸入約 3,500 tokens（系統指示＋知識摘錄＋使用者結構化回答＋自由文字上限 500 字），輸出約 600 tokens＋少量推理。實際用量由 B-010 smoke test 以 `usage` 欄位量測後回填本表。

選擇哪個模型是**費用決策，由 Jerry 決定**。建議先用 `claude-opus-5` 跑 B-010 的合成資料評測；若品質在較便宜模型上一樣成立，再由 Jerry 決定是否降級。

費用與流量上限（建議值，需 Jerry 核准）：

| 控制 | 建議值 | 實作位置 |
|---|---|---|
| 供應商端月上限 | US$50／月（Anthropic Console spend limit，由 Jerry 在帳號設定；不開自動加值） | 供應商帳號 |
| 應用端每日上限 | 300 次 AI 呼叫／日（全站），超過回 `AI_UNAVAILABLE` | B-010／B-011（持久化計數） |
| 每 session | 3 次 Assessment／小時 | B-011 限流 |
| 單次 `max_tokens` | 2,000 | B-010 |
| 自由文字上限 | 500 字（server 端截斷前先驗證，超過回 `VALIDATION_ERROR`） | B-011 |

逾時與失敗行為（**不得退回 Fake 成功結果**）：

| 情境 | 行為 |
|---|---|
| 單次呼叫逾時 | 20 秒逾時；對 429／5xx／逾時最多重試 1 次（含退避） |
| 重試後仍失敗、供應商中斷、超出每日上限 | 回 `503 AI_UNAVAILABLE`，**不寫入** COMPLETED Assessment；前端提示稍後再試或撥 1966 |
| 模型輸出不符 schema／enum／缺預估語氣 | 視為失敗，回 `503 AI_UNAVAILABLE`，記錄錯誤類型（不含原文） |
| 模型拒答（`stop_reason = refusal`） | 同上 |
| 無 PUBLISHED 知識 | 回 `503 KNOWLEDGE_UNAVAILABLE`，**不呼叫模型** |

供應商資料處理條件：

- 送出資料：結構化回答＋自由文字（已移除疑似電話／身分證字號樣式）。**不送**姓名、電話、sessionId、IP。
- 使用結構化輸出（JSON schema）限制回傳格式；使用者輸入以「資料」包裝，不得覆寫系統指示（B-010 需測試提示注入）。
- API key 只存在 Netlify Functions 環境變數；前端、log、repo 皆不得出現。
- 供應商的資料保存與訓練使用條件**以 Jerry 核准當下的 Anthropic 商業條款為準**，由 Jerry 閱讀後把條款連結與日期填入 `docs/PRIVACY_AND_RETENTION.md` §5。此處不預先宣稱任何保存天數。
- 健康相關資料會傳送至境外供應商處理，需在隱私告知中揭露（見 D-05），並列為法務待確認事項。

### 方案 B（備援）：純規則引擎，不使用 LLM

- `careNeeds`／`priority` 由規則決定，`summary` 由核准過的模板組成。
- 優點：零 AI 成本、無境外健康資料傳輸、行為可完全測試。
- 缺點：與 PRODUCT_SPEC §16「AI 的責任」不一致；必須**先修訂 PRODUCT_SPEC／ARCHITECTURE** 才能採用。
- 觸發條件建議：若 10/12 前無法取得 D-05 的境外傳輸隱私確認，或 Jerry 不核准 AI 費用，改採方案 B。

### 需要 Jerry 決定

1. 採方案 A 或 B。
2. 方案 A 的模型 ID 與月上限金額。
3. 由誰在 Anthropic Console 建立 **staging 與 production 兩把不同的 API key**（本任務不代為申請或購買）。

---

## D-02 知識來源與首批內容包

- 來源登錄：`docs/knowledge/source-registry.md`
- 內容包：`contracts/knowledge/packs/KP-2026-09-23-001.json`（全部 `NEEDS_REVIEW`，`review.reviewedBy = null`）
- 需要 Jerry 決定：逐筆審核（核准／退回），並在 PR 留下審核紀錄。審核通過後由 J-003 經 B-008 流程在整合環境實際發布。

## D-03 內容包格式與發布規則

見 `contracts/knowledge/README.md` 與 `contracts/knowledge/content-pack.schema.json`。

## D-04 Session 安全

見 `docs/ARCHITECTURE.md` §20、`docs/DATA_MODEL.md` §4／§6／§22、`docs/API_CONTRACT.md` §3.1–3.4。

## D-05 隱私與保存

見 `docs/PRIVACY_AND_RETENTION.md`。所有文案版本在法務確認前都是 `DRAFT`，不得作為正式同意版本上線。

## D-06 Lead 接件

見 `docs/LEAD_OPERATIONS.md`。**接件人姓名、備援人與服務時段必須由 Jerry 指定真人並取得本人同意**；未指定前，J-004 不開放正式媒合。

## D-07 推薦排序

- A-003 報告：30 筆 Provider 全部沒有可追溯的已驗證座標（刻意不猜）。
- 因此 MVP 的 Recommendation 只使用 `DISTRICT_ROTATION`；`DISTANCE` 分支保留在 contract，但在資料具備已驗證座標前不得啟用，也不得宣稱「距離最近」。
- 下游：B-005 實作兩個分支但以資料有無座標決定；C-003 已支援 `DISTRICT_ROTATION` 畫面。

## D-08 MVP 不收集 GPS

- 理由：無已驗證 Provider 座標（D-07），收集 GPS 沒有用途，違反資料最小化。
- 前端只收縣市＋行政區（目前 C-002 已是如此）。
- 若日後啟用距離排序，需重新修訂隱私文件與同意版本。

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

1. `netlify.toml` 加入 `ignore` 規則：只變更 docs／tasks／contracts 文件的提交**不觸發**建置。
2. Jerry 集中合併、減少 staging 部署次數；E2E 驗收期間約定部署時段。
3. 需要 Jerry 決定：是否在 9/29 前購買額度、是否取消降級、Kareocar 是否需要先恢復。這些都是付費決策，本任務不代為操作。
