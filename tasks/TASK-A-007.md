# TASK-A-007 — Assistive Device Resource Centers Data（雙北輔具資源中心資料）

Owner: Engineer A — Provider Data
Status: A-007-r2 本機驗證完成，中央整合 PR 待合併；真實公開查詢待 J-003
Plan revision: 2026-10-01 / J-002-r8（MVP_DECISIONS D-19 Q2，[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)；PRODUCT_SPEC §14a）

## Goal / 目標

讓使用者在資源查詢中找得到臺北市、新北市的輔具資源中心（地址、電話、官網、Google Maps、服務範圍）。資源中心是公共資源：**只供查詢，不是推薦候選，也不能媒合**。

## Allowed Paths

```text
/data/providers/**
```

## Deliverables

1. 以官方來源（臺北市政府社會局、新北市政府社會局等雙北政府網站）整理雙北輔具資源中心清單：名稱、地址、縣市、行政區、電話、官網、Google Maps URL、座標（依 A-003 方式驗證）、來源與查核日期。新來源登錄於 `data/providers/sources/source-registry.md`。
2. 匯入格式：`type = OTHER`、`resourceCategory = ASSISTIVE_DEVICE_CENTER`、**不建立 ProviderService**；既有 30 家補上 `resourceCategory = SERVICE_PROVIDER`（或依 B-013 匯入規則省略即為預設，需與 B 對齊後擇一，在 PR 寫明）。
3. 服務範圍：只依官方明示的服務對象或轄區建立（例如官方寫明服務該市市民），寫明原文與來源；沒有明示就不建立，維持「服務範圍待確認」。
4. 更新 A-004 驗證 gate：接受 `type = OTHER` 且沒有 ProviderService 的資源中心；仍拒絕其他沒有服務的 `SERVICE_PROVIDER`。
5. 報告：`qa/resource-center-report.md`（清單、來源、未收錄原因）。

## 規則

- 只收官方來源可確認的機構；不得以民間名單、地圖搜尋結果或推測補資料。
- 不得把資源中心標成任何 `serviceType`，避免進入推薦。
- 不自行對外聯絡；需要確認時列出需求交 Jerry。

## Acceptance Criteria

- [x] 每一筆資源中心都有官方來源與查核日期
- [x] `node data/providers/qa/validate-providers.mjs` 與既有 gate 全部通過；資源中心沒有 ProviderService
- [x] 既有 30 家資料不受影響
- [x] 報告數字由腳本產生

## Not In Scope

住宿機構（D-19 延後）；修改契約、後端或前端；對外聯絡。

## Submission / Completion

Branch：`feat/a-007-resource-centers`　Submission Version：`A-007-r1`　PR → `staging`，引用 Issue #49
PR Title：`[A-007] Assistive device resource centers data`

## 變更紀錄

- 2026-10-01 J-002-r8：依 D-19 Q2 建立。

## A-007-r2 中央收尾（2026-10-04）

5／5 官方精確門牌點已驗證，報告由 `qa/resource-center-report.mjs` 產生／檢查；原 A-006 基準逐筆全欄位 SHA-256 保護，缺資料／數量漂移／中心誤入服務推薦均有反例。中央整合已獲 Jerry 跨模組授權；合併後仍需 B-013/C-007 真實公開查詢驗收，不以模組勾選代替 INTEGRATED。
