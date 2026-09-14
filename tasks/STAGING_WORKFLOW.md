# Staging Workflow

本專案固定使用：

```text
Feature Branch
↓
PR → staging
↓
Jerry Review + Integration / E2E Test
↓
Release PR: staging → main
↓
Production
```

## Engineer A / B / C

- 從最新 `staging` 建 Feature Branch。
- 只 Push 自己的 Feature Branch。
- 一般 PR 的 Base 一律選 `staging`。
- 不直接 Push `staging`。
- 不直接 Push `main`。

## Jerry

- Review 所有 Feature PR。
- Merge 通過的 Feature PR 到 `staging`。
- 在 staging 進行跨模組整合與 E2E Test。
- 通過後建立 `staging → main` Release PR。
- main 通過後才部署 Production。
