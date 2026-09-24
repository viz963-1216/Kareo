# TASK-A-004 — Provider Validation Gate

Owner: Engineer A — Data / QA / Research  
Type: Data Validation  
Status: MERGED（PR #18，A-004-r2）— 模組完成，不代表整合完成或正式環境驗收（2026-09-23 J-002-r4 核對）  

---

# Goal / 目標

建立可重複執行的 Provider Dataset validation gate，讓 B 匯入 Supabase 前可以自動檢查資料品質。

---

# Prerequisite / 前置條件

A-003 已 Merge。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/a-004-provider-validation-gate
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
A-004-r1
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
/data/providers/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

在 `/data/providers/**` 內建立 validation script / 工具，至少檢查：
- 必填欄位
- Enum
- Provider ID / Service ID / ServiceArea ID 唯一性
- lat/lng 合法範圍
- city / district 基本一致性
- URL 格式
- phone 基本格式
- Provider / Service / ServiceArea 關聯完整性
並輸出可閱讀的 validation report。

---

# Acceptance Criteria

- [ ] Validation 可重複執行
- [ ] 正常資料通過
- [ ] 刻意錯誤 fixture 能被抓到
- [ ] Exit code / 結果能供後續 CI 或 B-004 使用
- [ ] 不改 Backend / Schema

---

# Not In Scope

資料匯入 Supabase、API、UI、跨模組 E2E。

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
[A-004] Provider Validation Gate
```
