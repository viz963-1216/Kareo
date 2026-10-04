# TASK-C-007 — Homepage Entry + Resource Lookup Page（首頁入口與資源查詢頁）

Owner: Engineer C — Frontend  
Status: MERGED（#58、#71）；首頁入口與資源查詢 UI 已交付，B-013 已接線；Preview 查詢仍缺 DB 憑證，不計 Integrated。（2026-10-04 J-003-r12 核對）
Plan revision: 2026-10-01 / J-002-r6（[Issue #49](https://github.com/viz963-1216/Kareo/issues/49)；PRODUCT_SPEC §14a、§53–54；API_CONTRACT §10、§10a）

## Goal / 目標

讓使用者不必先做評估，就能從首頁進入「查詢長照資源」，查到雙北收錄的服務單位與聯絡方式；同時清楚表示這是資訊查詢、不是個案推薦。

## Prerequisite / 前置條件

- Mock：`contracts/mock/providers/lookup/`（7 種成功、6 種錯誤、request 範例）、`contracts/mock/providers/PROV-MOCK-204.json`（範圍待確認）、既有 `PROV-MOCK-*`（已加 `serviceAreaStatus`）。對照表見 `contracts/mock/README.md`「資源查詢 fixtures」。
- 縣市與行政區清單：`contracts/reference/service-districts.json`。
- 真實 API：B-013 合併後由 J-003 接線。

## Allowed Paths

```text
/apps/web/**
```

## Deliverables

- **首頁**：新增次要入口「查詢長照資源」。主要 CTA 仍是「開始免費長照評估」（PRODUCT_SPEC §53）。
- **查詢頁**（例如 `/resources`）：
  - 篩選：服務類別、縣市（臺北市／新北市／其他縣市）、行政區、篩選方式（機構所在地／已確認服務範圍）、名稱關鍵字。
  - 選「其他縣市」時不呼叫 API，顯示「本階段只提供臺北市、新北市」與 1966 提示。
  - 列表：名稱、服務類別、地址、電話、官網、Google Maps（URL 只用資料提供的，不自行組）；顯示 API 的 `notice` 原文。
  - `serviceAreaStatus = UNCONFIRMED` 的項目固定標示「服務範圍待確認，請洽機構」。
  - 依服務範圍篩選且 `unconfirmedCount > 0` 時，提供「一併顯示服務範圍待確認的 N 家」（以 `includeUnconfirmed=true` 重新查詢）；待確認的項目與已確認的分開呈現。
  - 分頁；loading、empty、error、RWD、鍵盤操作。
- **詳細頁**（沿用 `/providers/:providerId`）：
  - 顯示 `serviceAreaStatus`；`UNCONFIRMED` 時顯示「服務範圍待確認，請洽機構」。
  - 從查詢頁進入時**不帶** lead state，**不顯示**「我要媒合」，改顯示「如需媒合，請先完成免費評估」並連到評估入口。
- `realAdapter`／`mockAdapter` 新增查詢呼叫，格式完全依 §10a。

## 追加（2026-10-01，D-19 Q1／Q2／Q4，[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)）

- **特約縣市**：輔具商家顯示 `contractRegions`（例如「列於臺北市輔具特約廠商名單」），並加上說明「長照輔具補助須向核定縣市的特約廠商購置；特約名單不代表能到府或服務您所在的行政區」。篩選新增「特約縣市」（`contractCity`）。
- **輔具資源中心**：篩選新增資源類別（服務單位／輔具資源中心，`resourceCategory`）；選資源中心時停用服務類別篩選。資源中心的詳細頁不顯示媒合入口。
- **Kareocar 常駐入口**（PRODUCT_SPEC §13、ARCHITECTURE §10）：首頁與導覽列加「長照交通預約（Kareocar）」，外部新分頁（`target="_blank"`、`rel="noopener noreferrer"`），標示為外部服務；網址與結果頁相同，不得出現第二個網址。
- 對照 fixtures：`list-contract-city`、`list-resource-center`、兩個新錯誤、`PROV-MOCK-301`。

## 用詞規則

查詢頁與從查詢頁進入的詳細頁，不得出現「推薦」「為您推薦」「最近」「附近」「適合您」「一定可到府」。API `notice` 照原文顯示。

## Acceptance Criteria

- [ ] 每個 lookup fixture 都有對應畫面（含空結果、超出頁數、6 種錯誤）
- [ ] `PROV-MOCK-204` 在查詢頁可見並標示待確認；三重區輔具推薦頁（既有 fixture）不顯示它
- [ ] 從查詢頁進入詳細頁沒有「我要媒合」；從推薦進入仍有（既有行為不變）
- [ ] 用詞檢查自動化（測試掃描查詢頁輸出）
- [ ] 既有前端測試全部通過；real API 模式 build 通過

## Not In Scope

修改推薦頁或 Lead 流程；長照資訊頁、個管師摘要、輔具資源中心、住宿機構、首頁 Kareocar 入口（D-19，待 Jerry 決定）；自行定義新欄位。

## Submission / Completion

Branch：`feat/c-007-resource-lookup-ui`　Submission Version：`C-007-r1`　PR → `staging`，引用 Issue #49  
PR Title：`[C-007] Homepage entry and resource lookup page`

## 變更紀錄

- 2026-10-01 J-002-r6：依 Issue #49 建立。
- 2026-10-01 J-002-r8：追加特約縣市、輔具資源中心、Kareocar 常駐入口（D-19）。
