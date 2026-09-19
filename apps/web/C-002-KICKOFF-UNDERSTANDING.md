# C-002 開工前理解報告

Task ID：`TASK-C-002`  
Task Name：Frontend MVP Foundation  
Owner：Engineer C — Frontend  
Feature Branch：`feat/c-002-frontend-mvp-foundation`  
首次提交版次：`C-002-r1`  
狀態：Jerry 已確認，准予開工（2026-09-19）

## 1. 我的任務是什麼

依 `TASK-C-002` 實作 Kareo 第一段可操作的 Frontend User Flow：

```text
Homepage
→ Consent / Disclaimer
→ Assessment
→ Preliminary Result Shell
```

前端採用 Jerry 已核准的 React、Vite、TypeScript 與 React Router，並使用 Mock Data 與 API Adapter 完成開發，不等待 Engineer B 的 Real API。

本任務只建立第一階段前端流程，不包含 Provider Top 3、Provider Detail、Lead Backend、Recommendation Engine、Real Supabase、Real API 正式接線或 Production Deploy。Mock 切換 Real API 與跨模組整合由 Jerry／J-003 在 `staging` 處理。

## 2. Allowed Paths

只能新增或修改：

```text
/apps/web/**
```

可在此目錄內建立該 Frontend App 自己的：

- `package.json` 與 `package-lock.json`
- Vite 與 TypeScript 設定
- React 原始碼與樣式
- 前端專用測試或設定
- `.gitignore`

## 3. Forbidden Paths

不得修改：

```text
/apps/api/**
/services/**
/data/providers/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

也不得修改：

- Repository Root Config
- Root `package.json` 或 Lockfile
- Root Deployment Config
- Backend Schema 或 Migration
- API Contract、Data Model 或 enum
- Recommendation Ranking
- Knowledge PUBLISHED 規則
- Kareo 全站 Release Version
- `staging` 或 `main`

如果實作需要跨越上述範圍，應停止並回報 Jerry，不可自行修改。

## 4. Input 是什麼

主要規格輸入：

- `AGENTS.md`：共同開發守則與 Ownership。
- `docs/PRODUCT_SPEC.md`：產品流程、初步預估語氣、免費使用、服務範圍與免責要求。
- `docs/ARCHITECTURE.md`：前後端隔離、Mock／Real API 邊界及 Engineer C Ownership。
- `docs/DATA_MODEL.md`：Assessment、Consent、CareNeedProfile 欄位與 enum。
- `docs/API_CONTRACT.md`：Session、Consent、Assessment 的固定 Request／Response 格式。
- `docs/GIT_RULES.md`：分支、提交、PR、版次和 Changelog 規則。
- `tasks/TASK-C-001.md`：前端頁面、狀態及 API Adapter 的既有規劃。
- `tasks/TASK-C-002.md`：本次實作範圍與驗收條件。

Assessment 輸入欄位：

```text
ageRange
city
district
livingSituation
caregiverSituation
mobilityLevel
dailyLivingLevel
homeCareNeed
medicalNursingNeed
assistiveDeviceNeed
transportationNeed
freeText
```

Consent 輸入必須包含：

```text
sessionId
disclaimerVersion
privacyVersion
termsVersion
accepted
```

J-002 正式隱私及同意文案尚未交付時，只能使用清楚標記為 Mock／暫行版本的文案，不可宣稱正式文案已通過驗收。

## 5. Output 是什麼

交付一套可在本機操作的 C-002 前端。

### Homepage

- Kareo 產品定位
- 「開始免費長照評估」CTA
- 初步預估提醒
- 非政府正式核定提醒

### Consent / Disclaimer

- Disclaimer
- Privacy Notice 入口或區塊
- Clickwrap checkbox
- 未同意時禁止進入 Assessment

### Assessment

- 完整呈現 Contract／Data Model 指定欄位
- 驗證並轉換為 API Contract Request 格式

### Preliminary Result Shell

- Care Need
- Priority
- Summary
- Warnings
- 「初步預估」標示
- 1966／所在地長期照顧管理中心正式評估提醒

### API Adapter 與狀態

- UI 不直接散落 Mock Data
- 保留日後切換 Real API 的 Adapter Boundary
- 支援 `LOADING`、`SUCCESS`、`EMPTY`、`ERROR`
- 錯誤或逾時不得產生假的成功結果

### RWD 與 Accessibility

- Mobile First
- 手機可完整完成 Assessment
- Button／Input 有清楚 Label
- Keyboard 可操作
- Error 不只靠顏色表示
- 具備基本文字對比與可讀性

## 6. Acceptance Criteria

- [ ] Homepage 可操作
- [ ] Consent 未同意不能進 Assessment
- [ ] Assessment 欄位符合既有 Contract／Data Model
- [ ] 可以使用 Mock 完成 Assessment Flow
- [ ] Preliminary Result 顯示 `summary` 與 `warnings`
- [ ] `LOADING / SUCCESS / EMPTY / ERROR` 均有處理
- [ ] API Client／Mock 已隔離
- [ ] 未直接連接 Supabase 核心 Business Logic
- [ ] Frontend 不含 AI Key 或其他 Secret
- [ ] 手機可完整完成 Assessment
- [ ] Button／Input 有清楚 Label
- [ ] Keyboard 可操作
- [ ] Error 不只依靠顏色表示
- [ ] 沒有單一超大型 `index` 檔
- [ ] 沒有修改 Allowed Paths 以外的檔案
- [ ] PR Base 為 `staging`
- [ ] PR 包含 `C-002-r1` 與完整 Changelog
- [ ] 隱私／同意 Mock 文案未被標記為正式驗收完成

## 7. 預計修改哪些檔案

目前 `apps/web/` 已有以下未追蹤實作檔案。正式 Coding 前會先逐一審查，再於任務範圍內補正：

```text
apps/web/index.html
apps/web/package.json
apps/web/package-lock.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/src/main.tsx
apps/web/src/App.tsx
apps/web/src/styles.css
apps/web/src/types/api.ts
apps/web/src/api/mockAdapter.ts
apps/web/src/pages/HomePage.tsx
apps/web/src/pages/ConsentPage.tsx
apps/web/src/pages/AssessmentPage.tsx
apps/web/src/pages/ResultPage.tsx
```

視檢查結果，預計在 `/apps/web/**` 內補充：

```text
apps/web/.gitignore
apps/web/src/components/**
apps/web/src/api/**
apps/web/src/types/**
```

注意事項：

- `node_modules/` 不應提交。
- `dist/` 是建置產物，預設不應提交，除非 Jerry 另有明確要求。
- 不會為部署修改 Repository Root Config。
- 不會修改任何 Allowed Paths 以外的檔案。

## 開工確認

本報告只確認任務理解與執行邊界，不代表功能已完成或通過驗收。Jerry 已於 2026-09-19 確認本報告並准予開始 C-002 Coding。
