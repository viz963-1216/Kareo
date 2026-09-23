# TASK-B-006 — Lead API

Owner: Engineer B — Backend  
Type: Backend / Lead  
Status: QUEUED — 依賴 B-011a、B-005（B-004 已合併）；未見提交  

---

# Goal / 目標

讓使用者按「我要媒合」後，Lead 被保存並由 Kareo 接件人實際處理（PRODUCT_SPEC §28–29、LEAD_OPERATIONS）：

- `POST /api/v1/leads`：建立 Lead，關聯 Session／Assessment／Recommendation／Provider／Service。
- 受保護的內部查件與狀態更新指令（不是公開 API、不是 CRM），供接件人使用。

---

# Prerequisite / 前置條件

- B-004 已合併（完成）。
- **B-011a 已合併**：token、歸屬檢查、`Idempotency-Key` 共用元件。
- **B-005 已合併**：Lead 需驗證 `recommendationId` 屬於同一 session、`providerId` 在該推薦結果中（API_CONTRACT §12）。為避免循環，B-006 不修改 B-005 的表結構。
- 規格：API_CONTRACT v0.2 §12、DATA_MODEL §22／§36–38、LEAD_OPERATIONS（D-04、D-06 PROPOSED，可逆實作）。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-006-lead-api
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-006-r1
```

若退回修改，revision 依序遞增。

不得直接 Push `staging` 或 `main`。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
```

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

- Lead、LeadStatusEvent、LeadAccessEvent、InternalOperator migration／repository／service（DATA_MODEL §22、§36–38）
- `POST /api/v1/leads`：`contactConsent = true`、最少聯絡資料（稱呼、電話）、`Idempotency-Key`、`duplicate` 回應
- 內部查件與狀態更新指令（LEAD_OPERATIONS §4）：只有授權角色可用；狀態轉移依 §3；每次轉移寫 LeadStatusEvent；查看聯絡資料寫 LeadAccessEvent
- 操作說明（給接件人與 J-004 演練使用）
- Tests

---

# Acceptance Criteria

- [ ] API 符合 Contract；Lead 關聯 Session／Assessment／Recommendation／Provider／Service
- [ ] 跨 session 的 assessment／recommendation → `NOT_FOUND`；provider 不在推薦結果 → `VALIDATION_ERROR`
- [ ] 同一 `Idempotency-Key` 重送回原結果；不同內容 → `IDEMPOTENCY_CONFLICT`；併發送出只有一筆
- [ ] 非法狀態轉移 → `INVALID_STATUS_TRANSITION`；未授權查件被拒
- [ ] log 與錯誤訊息不含姓名、電話、token
- [ ] 不收集 Task 外敏感資料；Tests 通過
- [ ] 真人接件演練不在本任務（J-004）；真實 E2E 由 J-003

---

# Not In Scope

Provider CRM、Payment、商家後台、Frontend Lead Form。

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
[B-006] Lead API
```

---

---

# 變更紀錄

- 2026-09-19：補內部查件／狀態更新工具與驗收。
- 2026-09-23 J-002-r4：補充整併進主文；前置改為 B-011a＋B-005（recommendationId 驗證需要推薦結果），移除與 B-005 平行的舊說法。
