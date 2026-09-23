# Kareo MVP Decisions / MVP 決策紀錄

Submission Version: J-002-r2
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
| D-01 | Assessment 判斷方式 | **APPROVED：方案 B 規則引擎，不使用 AI** | D-01-v2 | Jerry | Jerry 2026-09-23 於 PR #19 審查時決定（理由：AI token 成本） | B-010、J-003、J-004 |
| D-02 | 知識來源白名單與首批內容包 `KP-2026-09-23-001` | PROPOSED（內容待逐筆審核） | D-02-v1 | Jerry（審核人） | — | B-008、J-003 首次發布、B-010 |
| D-03 | 知識內容包格式、匯入驗證、發布／撤回規則 | PROPOSED | D-03-v1 | Jerry | — | B-008 |
| D-04 | 匿名 session 持有證明、有效期、資源歸屬、濫用限制、冪等、刪除 | PROPOSED | D-04-v1 | Jerry | — | B-011、B-006、B-005、J-003 adapter |
| D-05 | 隱私、同意版本、保存／刪除、外部資料流 | PROPOSED（法務待確認） | D-05-v1 | Jerry | — | B-011、C-005、J-004 |
| D-06 | Lead 接件方式、角色、狀態轉移、回覆時程 | PROPOSED；接件人 **BLOCKED** | D-06-v1 | Jerry | — | B-006、J-004 |
| D-07 | MVP 推薦排序只使用行政區輪替（無距離排序） | DECIDED-BY-SPEC＋資料事實 | D-07-v1 | Jerry | A-003 報告：30/30 Provider 無已驗證座標 | B-005、C-003 |
| D-08 | MVP 不收集 GPS | PROPOSED | D-08-v1 | Jerry | — | C、B-011、隱私文件 |
| D-09 | Netlify 部署額度與部署觸發策略 | PROPOSED；額度 **BLOCKED** | D-09-v1 | Jerry | — | J-003、J-004 |

---

## D-01 Assessment 判斷方式

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
