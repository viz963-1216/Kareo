# TASK-B-011 — Session Ownership + Privacy + API Abuse Controls

Owner: Engineer B  
Status: QUEUED（依下列前置條件啟動）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / Input

2026-09-23 修訂（J-002-r3）：分兩段，避免所有防護等到最後才實作。

**B-011a Session／權限基礎（先做，供其他 API 開發使用）**

- 範圍：`POST /session` 發 `sessionToken`（密碼學隨機、只存雜湊）、`X-Kareo-Session-Token` 驗證、有效期、Body `sessionId` 與 token 一致、資源歸屬檢查（不屬於同一 session → `NOT_FOUND`）、Consent 版本驗證（`contracts/legal/consent-versions.json` ACTIVE 組合）、v0.2 錯誤碼與 HTTP 對照（API_CONTRACT §3.2）、`Idempotency-Key` 的共用驗證元件。
- 時機：B-004、B-008 之後，**B-005／B-006 開始前**。B-005、B-006、B-010 直接使用這些元件，不各自實作。
- 依據：API_CONTRACT v0.2 §3（D-04 目前 PROPOSED；核准前屬可逆實作，提案修改時由 J-002 通知）。
- 分支 `feat/b-011a-session-token`，Submission Version `B-011a-r1`。

**B-011b 完整安全驗收（B-005／B-006／B-010 完成後）**

下列「Deliverables / 驗收」全部項目，包括限流、RLS 權限測試、log 清理、保存期限清理、併發冪等與安全驗收矩陣。

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
