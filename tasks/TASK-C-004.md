# TASK-C-004 — Provider Detail + Google Maps

Owner: Engineer C — Frontend  
Type: Frontend / Provider  
Status: QUEUED — DO NOT START UNTIL C-003 MERGED

---

# Goal / 目標

完成 Provider Detail 頁與 Google Maps CTA，完全依既有 Provider Contract 顯示資料。

# Prerequisite

C-003 已 Merge；使用 `contracts/mock/provider-response.json` 開發。

# Branch / PR Rule

從最新 `staging` 建立 `feat/c-004-provider-detail-google-maps`，完成後 PR → `staging`。  
首次提交版次：`C-004-r1`。

# Allowed Paths

```text
/apps/web/**
```

# Required Deliverables

- Provider Detail route / page
- services / serviceAreas
- phone / website / verified
- Google Maps external CTA
- loading / not found / error
- safe external-link behavior

# Acceptance Criteria

- [ ] Maps URL 只使用 API 提供值
- [ ] 不自行拼 Google Maps URL
- [ ] 不自行推測 Service Area
- [ ] Not Found / Error 有狀態
- [ ] Mobile 可用
- [ ] 不修改 Backend / Contract

# Not In Scope

Google Maps embedded map、Provider Ranking、Backend。

# Completion Report

PR 必須包含 Submission Version、Added / Changed / Fixed、Tests、Known Issues、Scope Check。

PR Title：`[C-004] Provider Detail + Google Maps`
