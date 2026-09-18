# TASK-B-011 — Session Ownership + Privacy + API Abuse Controls

Owner: Engineer B  
Status: QUEUED（依下列前置條件啟動）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / Input

J-002 的安全/隱私/保存規格已合併；B-003/B-005/B-006/B-008/B-010 的相關 API 已完成後進行完整驗收。各 API 開發時即依核准規格實作基本防護，不等本任務才考慮。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/apps/api/**`、`/services/**`
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / 驗收

- [ ] 依核准協議驗證匿名 session 持有證明、期限、Consent 與版本；Assessment/Recommendation/Lead 關聯都驗證同一 session，不能只驗證資料存在。
- [ ] 測試 session A 不能讀寫 session B 資料、偽造/過期憑證、缺同意、撤回後操作。若設計使用 cookie，驗證 SameSite/Secure 與 CSRF 防護。
- [ ] 敏感資料表啟用 RLS；測試 anon/authenticated 無非授權讀寫，service-role API 仍做資源歸屬與角色驗證。新增 migration 同步補權限測試。
- [ ] 依 J-002 設定 API payload/文字長度上限、持久化且適用 serverless 的限流；驗證多 instance/多次請求不會繞過，不以 process 記憶體計數充當正式保護。
- [ ] Lead 冪等/重複送出保護遵守 contract；重試不產生重複案件，並驗證併發。
- [ ] log/error 移除健康原文、姓名電話、token；公開 API 不洩漏 stack、SQL 或 secret。
- [ ] 提供受權限保護、可 dry-run 的保存期限清理與刪除操作；按規格處理關聯資料，附合成測試、執行紀錄與失敗重試方式。
- [ ] 提供安全驗收矩陣及操作指令，供 J-003/J-004 執行；任何必要 schema/contract 缺漏先交 Jerry 更新，不自行新增。

## Not In Scope

會員系統、付款、完整資安認證、公開管理後台。


## Submission / Completion

從最新 `staging` 建立 `feat/b-011-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `B-011-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。
