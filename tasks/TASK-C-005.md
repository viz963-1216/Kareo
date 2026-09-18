# TASK-C-005 — Lead Flow + Final MVP UX QA

Owner: Engineer C — Frontend  
Type: Frontend / Lead / UX  
Status: QUEUED — DO NOT START UNTIL C-004 MERGED

---

# Goal / 目標

完成 Lead Form 與前端 MVP 最終 UX 收斂：表單、成功/失敗、RWD、Accessibility、Disclaimer 與全流程狀態一致性。

# Prerequisite

C-004 已 Merge；使用 `contracts/mock/lead-response.json` 開發。

# Branch / PR Rule

從最新 `staging` 建立 `feat/c-005-lead-final-ux`，完成後 PR → `staging`。  
首次提交版次：`C-005-r1`。

# Allowed Paths

```text
/apps/web/**
```

# Required Deliverables

- Lead Form
- name / phone validation
- submit / success / error state
- selected Provider / Service context
- Mobile / Tablet / Desktop QA
- Keyboard / label / focus 基礎 Accessibility
- Homepage / Result / Recommendation / Footer Disclaimer 用語稽核
- 全站 LOADING / SUCCESS / EMPTY / ERROR 一致化

# Acceptance Criteria

- [ ] Lead Flow 可用 Mock 完成
- [ ] 不收 Task 外敏感資料
- [ ] 正式資格用語維持「預估 / 可能」
- [ ] 1966 提醒位置符合 Product Spec
- [ ] RWD 與 Keyboard 基本通過
- [ ] 不直接連 Supabase
- [ ] 不修改 Backend / Contract

# Not In Scope

Backend Lead、CRM、Payment、Production Deploy。

# Completion Report

PR 必須包含 Submission Version、Added / Changed / Fixed、Tests、Known Issues、Scope Check。

PR Title：`[C-005] Lead Flow + Final MVP UX QA`
