# TASK-A-006 — Lookup Listing + Service Area Verification（可查詢資料與服務範圍補查）

Owner: Engineer A — Provider Data  
Status: READY — 用既有欄位查核可立即開始；不需等待 B-013／C-007  
Plan revision: 2026-10-01 / J-002-r6（[Issue #49](https://github.com/viz963-1216/Kareo/issues/49)；MVP_DECISIONS D-18；PRODUCT_SPEC §14a、§19；DATA_MODEL §19）

## Goal / 目標

讓雙北已收錄的服務單位在「公開資源查詢」（PRODUCT_SPEC §14a）中可查得到，並依可追溯證據補查服務範圍。**查得到**與**可被推薦**是兩件事：前者看收錄資格，後者需要已驗證的服務範圍。

本任務不是把 A-003 撤下的推定範圍改回 active，也不是要湊滿某個數量。

## 背景（2026-10-01 staging）

- 30 家 Provider、86 筆 active ProviderServiceArea（16 家）。
- 14 家沒有任何服務範圍：12 家輔具（SRC-004／SRC-005 只證明雙北簽約縣市）、TP-HMN-001／003（已確認提供居家護理，醫院本體範圍不能套用）。清單：`data/providers/qa/pending-verification.md`。
- 30 家的 `website` 皆為 null。
- Jerry 已確認、**不需再問**：輔具只限雙北（DEC-A003-01）、居家護理須確認服務單位本身有居家服務（DEC-A003-02）、吉評 NTPC-AD-004 採 Google Maps 商家座標（DEC-A003-07）。

## Allowed Paths

```text
/data/providers/**
```

Forbidden：其他全部（含 `/docs/**`、`/contracts/**`、`/apps/**`、`netlify.toml`）。

## Deliverables

1. **14 家逐筆核對**（另可涵蓋其餘 16 家）：名稱、服務類型、地址、電話、官網、Google Maps、雙北關聯證據、來源、查核日期、已確認與未知的服務範圍。每家給一個收錄狀態：
   - `LISTED_AREA_VERIFIED`：可查詢，且有已驗證範圍（可進推薦）
   - `LISTED_AREA_UNCONFIRMED`：可查詢，範圍待確認（不進推薦）
   - `NOT_LISTED`：不收錄，寫明來源或原因（例如身分無法確認、來源矛盾、非雙北）
2. **服務範圍補查**：只有找到可追溯的行政區範圍（官方名單的特約服務區域、服務單位本身的正式書面範圍等）才新增 active ProviderServiceArea，並在 `qa/a-003-evidence.json`（或新的 A-006 證據檔）記錄來源與查核日期。找不到就保留待查紀錄。
3. **官網**：只填服務單位或其母機構的官方網址；找不到維持 null。
4. **兩份分開的報告**（數字由腳本重算，不手寫）：
   - `qa/lookup-listing-report.md`：可查詢收錄清單
   - `qa/recommendation-coverage-report.md`：可推薦候選覆蓋（服務類型 × 行政區）
5. **給 B／C 的對照表**：每家的 `serviceAreaStatus`（`VERIFIED`／`UNCONFIRMED`，DATA_MODEL §19 推導規則）與查詢時應出現的條件。
6. 若需要致電或寄信才能確認，列出具體需求清單（對象、要問什麼、為什麼）交 Jerry；**不得自行對外聯絡**。

## 規則

- 不得以地址、簽約縣市或母機構範圍推定服務範圍；不得為了補足推薦家數新增範圍（DATA_MODEL §19）。
- 已撤下的平台推定範圍不得直接恢復；須依最新資料重新查核。
- 保留既有 30 家與可追溯證據，不重建、不刪除有效資料。
- 不改座標（NTPC-AD-004 依 DEC-A003-07 維持）。
- `serviceAreaStatus` 是推導值，**不要**新增到 `providers.json`。如需新增機器欄位（例如範圍的 `sourceId`／`checkedAt`、特約縣市），先建 Issue 由 J-002 定義契約。

## Acceptance Criteria

- [ ] `node data/providers/qa/validate-providers.mjs`、`node data/providers/qa/verify-coordinates.mjs`、報告一致性檢查全部 exit 0
- [ ] 14 家每家都有收錄狀態與理由；`NOT_LISTED` 有來源或狀態原因
- [ ] 30 家沒有被無故刪除
- [ ] 每一筆新增的 active 範圍都有來源與查核日期；沒有任何以簽約縣市或母機構推定的範圍
- [ ] 兩份報告分開，數字由腳本產生
- [ ] 完整回歸：A-004 資料 gate、A-005 案例仍通過

## Not In Scope

輔具資源中心、住宿機構的資料（D-19）；對外聯絡；修改座標；修改契約或後端。

## Submission / Completion

Branch：`feat/a-006-lookup-listing`　Submission Version：`A-006-r1`　PR → `staging`，引用 Issue #49  
PR Title：`[A-006] Lookup listing and service area verification`

## 變更紀錄

- 2026-10-01 J-002-r6：依 Issue #49 建立。
