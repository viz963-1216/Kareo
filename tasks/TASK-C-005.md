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

---

## 2026-09-19 MVP 補充驗收與依賴

補驗收 J-002 隱私與同意版本、清除/重新開始 session 流程、送出期間防重複點擊、失敗可重試且不顯示假成功。健康回答/姓名電話/token 不進 URL 或 console；不任意長期保存於 localStorage。Lead 成功須以 API 成功回覆為準；說明接件方式/時程依核准文案，不宣稱已完成媒合。Mock 驗收與 J-003 真實 E2E 分別標記。

此補充不授權改寫高順位規格；所需規格更新由 TASK-J-002 先合併。

---

## 2026-09-23 補充：位置情境與驗收分層（J-002-r3）

- 位置輸入需涵蓋 PRODUCT_SPEC §21–24 三種情境：精確位置、只有行政區、不提供位置。
  - 只有行政區、不提供位置：現在即可做。不提供位置時仍可完成評估與服務建議，提醒提供縣市／行政區，不顯示「附近」。
  - 精確位置（GPS／完整地址）的**取得畫面**要等 D-08 決議與隱私告知更新（D-05）；在此之前不得收集或送出座標。
- 推薦結果畫面需涵蓋 `DISTANCE`（`contracts/mock/recommendations/ranking-variants/HOME_CARE-DISTANCE.json`）與 `DISTRICT_ROTATION` 兩種；距離只在 API 提供時顯示。
- **驗收分層**：本任務的驗收是 Mock 模組驗收（`VITE_KAREO_API_MODE=mock`），PR 需標示為「Mock 驗收」；真實 API 的 E2E 由 J-003 執行並記錄於 `docs/INTEGRATION_ACCEPTANCE.md`，不得以 Mock 結果代替。

此補充不擴增產品範圍，只把 PRODUCT_SPEC 原始 MVP 已有的要求指到承接任務；所需規格更新由 TASK-J-002 先合併。
