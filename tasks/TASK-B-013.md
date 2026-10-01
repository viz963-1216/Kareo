# TASK-B-013 — Public Resource Lookup API（公開資源查詢 API）

Owner: Engineer B — Backend  
Status: QUEUED — 契約 API_CONTRACT v0.5 §10a 待 Jerry 審核（D-18a–e）；B 的工作順序在 B-012-r3 之後  
Plan revision: 2026-10-01 / J-002-r6（[Issue #49](https://github.com/viz963-1216/Kareo/issues/49)；MVP_DECISIONS D-18；API_CONTRACT §10、§10a）

## Goal / 目標

提供不需評估、不需 session 的公開查詢：`GET /api/v1/providers` 列表／搜尋／分頁，並在既有詳細端點加上 `serviceAreaStatus`。推薦（B-005）規則完全不變。

## Prerequisite / 前置條件

- API_CONTRACT v0.5 §10a、§10 核准（本 J-002 PR）。
- 建議在 B-012-r3 之後開始（Issue #49 建議順序），避免同時修改 `types/index.ts`、repository。
- `contracts/reference/service-districts.json`（雙北行政區與排序順序）。

## Allowed Paths

```text
/apps/api/**
```

`netlify.toml` 的 `/api/v1/providers` 路由由 J-003 補（必須放在既有 `/api/v1/providers/*` 之前）。

## Deliverables

- 新 function（例如 `src/functions/providers.ts`）處理 `GET /api/v1/providers`；既有 `providerDetail.ts` 不改路由行為。
- 參數驗證完全依 §10a：`serviceType`、`city`、`district`、`areaFilter`、`includeUnconfirmed`、`q`、`page`、`pageSize`；未定義參數 → `VALIDATION_ERROR`。縣市／行政區清單讀 `contracts/reference/service-districts.json`，不在程式內另寫一份。
- 查詢只讀（Supabase REST），不新增 RPC、不新增 migration；只回 `status = ACTIVE`。
- `serviceAreaStatus` 依 active ProviderServiceArea 推導；`LOCATED_IN` 比對 Provider `city`／`district`，`SERVICE_AREA` 只比對 active 範圍；`unconfirmedCount`、`appliedFilters`、`notice`、排序、分頁依 §10a。
- 列表項目只回 §10a 列出的 13 個欄位；不得回 `lat`、`lng`、`status`、時間戳、證據或內部欄位。
- §10 詳細回應新增 `serviceAreaStatus`。
- 不讀寫 Session、Assessment、RecommendationRun、Lead；log 不記錄查詢條件（PRIVACY_AND_RETENTION §2）。
- 限流沿用 B-011 元件（`Provider lookup` 120 次／小時，ARCHITECTURE §20.4）；元件尚未完成時列為 Known Issue，由 B-011b 追蹤。

## Acceptance Criteria

- [ ] 不帶任何 token 可查詢；回應格式與 `contracts/mock/providers/lookup/*-response.json` 相同（J-003 以 fixtures 對照）
- [ ] 每種錯誤情境回 `VALIDATION_ERROR`（對照 `contracts/mock/providers/lookup/errors/`）
- [ ] **同機構對照測試**：沒有 active 範圍的 Provider 出現在 `LOCATED_IN` 結果；在 `SERVICE_AREA` 預設不出現、只計入 `unconfirmedCount`，`includeUnconfirmed=true` 時列在最後並標 `UNCONFIRMED`；同一筆資料下 `findEligibleForRecommendation` 不會選到它
- [ ] 排序固定（縣市 → 行政區 → id）；`page` 超出範圍回空陣列與正確 `totalCount`
- [ ] 回應不含座標、狀態、時間戳或證據欄位（測試證明）
- [ ] B-005 推薦既有測試全部通過；推薦規則沒有改動
- [ ] `npx tsc --noEmit`、`npx vitest run` 通過；不連正式資料庫

## Not In Scope

推薦、距離、輪替、Lead、session；特約縣市欄位（D-18 Q1 未決）；輔具資源中心與住宿機構（D-19）；`netlify.toml`。

## Submission / Completion

Branch：`feat/b-013-resource-lookup-api`　Submission Version：`B-013-r1`　PR → `staging`，引用 Issue #49  
PR Title：`[B-013] Public resource lookup API`

## 變更紀錄

- 2026-10-01 J-002-r6：依 Issue #49 建立。
