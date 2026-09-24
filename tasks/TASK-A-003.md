# TASK-A-003 — Provider Geocoding + Service Area QA

Owner: Engineer A — Data / QA / Research  
Type: Data QA  
Status: r1 MERGED（PR #13，模組完成）；**r2 已驗證座標 READY**（A-004 已合併）  
Plan revision: 2026-09-23 / J-002-r4

---

# Goal / 目標

讓 Provider Dataset 支援原始 MVP 的兩種推薦方式（PRODUCT_SPEC §18–23）：

- **只有行政區**：服務範圍（ProviderServiceArea）每筆有來源，與實體地址分開（r1 已完成）。
- **精確位置**：Provider 有**可追溯的已驗證座標**，讓 B-005 能依距離排序（r2）。r1 報告 30／30 筆沒有已驗證座標（刻意不猜），這是資料缺口（MVP_DECISIONS D-07），不是產品範圍縮減。

---

# Prerequisite / 前置條件

- r1：A-002 已合併（完成）。
- r2：A-004 已合併（完成，PR #18）；以 staging 的 `data/providers/staging/*.json` 為基礎。
- 只能使用可追溯來源；不知道的資料保留 null／UNKNOWN，不可猜測。
- 使用任何付費或需授權的 geocoding／地圖服務前，先交 Jerry 決定（費用與授權）；本任務不授權購買。

---

# Branch / PR Rule

- r1（已合併）：`feat/a-003-provider-geocoding-service-area-qa`
- r2：從最新 `staging` 建立 `feat/a-003-verified-coordinates`，Submission Version `A-003-r2`，PR → `staging`。

退回修改時 revision 依序遞增。不得直接 Push `staging` 或 `main`。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md（§18–24）
docs/DATA_MODEL.md（§17 Provider lat/lng）
docs/API_CONTRACT.md（§9 位置與排序）
docs/MVP_DECISIONS.md（D-07、D-13c）
docs/GIT_RULES.md
```

---

# Allowed Paths / 可修改範圍

```text
/data/providers/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

r1（已交付）：

- 地址與行政區一致性檢查、Service Area 來源核對、Google Maps URL 可用性檢查
- `/data/providers/qa/geocoding-service-area-report.md`

r2（待交付）：

- `data/providers/staging/providers.json` 只填**已驗證**的 `lat`／`lng`（WGS84 十進位度數）；無法驗證者保持 `null`。
- 每筆座標的來源、驗證方式（例如官方公開座標、官方地址＋人工於地圖核對門牌）與驗證日期，記錄在 `data/providers/qa/` 的座標報告（不改 Provider schema）。
- **覆蓋率報告**：依服務類型 × 縣市 × 行政區列出「有已驗證座標／候選總數」，並標出「整個行政區候選都有座標」的組合——這些組合才會走 `DISTANCE`（API_CONTRACT §9、D-13c）。
- 列出無法驗證的 Provider 與原因。

---

# Acceptance Criteria

- [x] r1：已檢查 A-002 全部 Provider；Service Area 每筆有來源或明確 UNKNOWN；不把實體地址推測成服務範圍
- [ ] r2：每筆非 null 座標都有來源、驗證方式與日期，可由他人重現核對
- [ ] r2：沒有任何座標由地址文字、行政區中心點或其他推估方式產生
- [ ] r2：覆蓋率報告（服務類型 × 縣市 × 行政區）完整，並指出可測試 DISTANCE 的組合
- [ ] r2：`node data/providers/qa/validate-providers.mjs`（A-004 gate）通過，座標範圍合法
- [ ] 沒有修改 `/data/providers/**` 以外檔案

真實距離排序的 E2E 由 J-003 使用本報告挑選案例執行；A 不負責跨模組驗收。

---

# Not In Scope

Backend、Supabase、Recommendation、Frontend、正式 E2E、購買 geocoding 服務。

---

# Completion Report

PR 必須回報：

```text
Submission Version:
Added:
Changed:
Fixed:
Tests / QA:
Known Issues:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[A-003] Provider Geocoding + Service Area QA
```

---

# 變更紀錄

- 2026-09-23 J-002-r3：新增已驗證座標補充驗收（D-07 資料缺口）。
- 2026-09-23 J-002-r4：補充整併進 Goal／Deliverables／AC；移除「若 D-08 核准可延後」（D-08 未核准、已擱置，精確位置依原始 MVP）；新增覆蓋率需對應 D-13c 的「整個行政區候選都有座標」。
