# TASK-B-011 — Session Ownership + Privacy + API Abuse Controls

Owner: Engineer B  
Status: B-011a **READY**（B-004、B-008 已合併）；B-011b QUEUED（依賴 B-005、B-006、B-010）；皆未見提交  
Plan revision: 2026-09-23 / J-002-r4 / 10-22 MVP

## Goal / 目標

匿名使用者的資料只有本人能讀寫，並能撤回同意與刪除（PRODUCT_SPEC §30–32、§36–37，PRIVACY_AND_RETENTION）。分兩段，讓共用防護在其他 API 開發**之前**就位，不等到最後才補：

| 分段 | 內容 | 時機 |
|---|---|---|
| **B-011a** 共用 session／歸屬保護 | `POST /session` 發 `sessionToken`（密碼學隨機、只存雜湊）、`X-Kareo-Session-Token` 驗證與有效期、Body `sessionId` 與 token 一致、資源歸屬檢查（不屬同一 session → `NOT_FOUND`）、Consent 版本驗證（`contracts/legal/consent-versions.json` 的 ACTIVE 組合）、v0.2 錯誤碼與 HTTP 對照（API_CONTRACT §3.2）、`Idempotency-Key` 共用驗證元件；既有 `generateId()` 的 `Math.random()` 不得用於 token | B-010、B-005、B-006 **開始前** |
| **B-011b** 完整安全驗收 | 限流、RLS 權限測試、log 清理、`DELETE /session`、`POST /consent/withdraw`、保存期限清理、併發冪等、安全驗收矩陣 | B-005、B-006、B-010 合併後 |

依據：API_CONTRACT v0.2 §3、ARCHITECTURE §20（D-04 已於 2026-09-24 核准）。

## Prerequisite / 前置條件

- B-011a：B-004、B-008 已合併（完成）。不依賴 B-005／B-006／B-010。
- B-011b：B-005、B-006、B-010 已合併；D-05 保存期限（PROPOSED，法務待確認）。
- 無 ACTIVE 同意版本（D-05 法務 BLOCKED）時，後端仍須拒絕 DRAFT 版本；測試使用明確標示的測試版本設定。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`（§20）、`docs/DATA_MODEL.md`（§4、§6、§22、§36–40）、`docs/API_CONTRACT.md`（§3、§6–7）、`docs/PRIVACY_AND_RETENTION.md`、`docs/GIT_RULES.md`、`tasks/README.md`。

## Allowed Paths / Forbidden Paths

Allowed: `/apps/api/**`、`/services/**`
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / Acceptance Criteria

B-011a：

- [ ] `POST /session` 回 `sessionToken`（≥256 bits、只存雜湊）與 `expiresAt`；既有 `sessionId` 回應相容
- [ ] 受保護 API 缺 token／錯誤／過期 → `SESSION_INVALID`；Body `sessionId` 不一致 → `FORBIDDEN`
- [ ] 共用歸屬檢查元件：session A 不能讀寫 session B 的 assessment（回 `NOT_FOUND`），B-005／B-006 可直接套用
- [ ] Consent 只接受 ACTIVE 組合，否則 `VALIDATION_ERROR`；DRAFT 版本被拒
- [ ] `AppError` 擴充 v0.2 錯誤碼與 HTTP status；`Idempotency-Key` 格式驗證元件
- [ ] 既有 session／consent／assessment function 套用；測試通過

B-011b：

- [ ] 測試偽造／過期憑證、缺同意、撤回後操作、跨 session 讀寫 assessment／recommendation／lead
- [ ] 敏感資料表啟用 RLS；anon／authenticated 無非授權讀寫；新增 migration 同步補權限測試
- [ ] 持久化且適用 serverless 的限流（不以 process 記憶體充當正式保護），多次請求不能繞過；payload／文字長度上限
- [ ] Lead 冪等與併發驗證（與 B-006 共同驗收）
- [ ] log／error 不含健康原文、座標、姓名電話、token；公開 API 不洩漏 stack、SQL 或 secret
- [ ] `DELETE /session`、`POST /consent/withdraw` 與可 dry-run 的保存期限清理（含座標、聯絡資料），附合成測試、執行紀錄與重試方式
- [ ] 安全驗收矩陣與操作指令，供 J-003／J-004 執行；schema／contract 缺漏先交 Jerry，不自行新增

## Not In Scope

會員系統、付款、完整資安認證、公開管理後台。

## Submission / Completion

| 分段 | Branch | Submission Version | PR Title |
|---|---|---|---|
| B-011a | `feat/b-011a-session-token` | `B-011a-r1` 起 | `[B-011a] Session Token + Ownership Guard` |
| B-011b | `feat/b-011b-security-acceptance` | `B-011b-r1` 起 | `[B-011b] Security + Privacy Acceptance` |

從最新 `staging` 建立，PR → `staging`，不得直接 push staging/main。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。

## 變更紀錄

- 2026-09-19：建立（單一任務）。
- 2026-09-23 J-002-r3：拆為 B-011a／B-011b。
- 2026-09-23 J-002-r4：B-011a 前置改為只依賴已合併的 B-004／B-008 → READY；B-010 也改為依賴 B-011a；統一兩段的 branch、Submission Version、PR 標題（取代舊的 `feat/b-011-mvp`／`B-011-r1`）；清理範圍加入座標。
