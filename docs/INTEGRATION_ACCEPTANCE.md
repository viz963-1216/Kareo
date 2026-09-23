# Kareo Integration Acceptance / 整合驗收紀錄

Owner: Jerry（TASK-J-003）
Submission Version: J-003-r1

> 只有「部署環境中，以真實 API 與真實資料實際操作成功」才算通過。
> Mock、單元測試、PR 合併都**不算**整合完成。平台額度或模組缺漏造成的阻擋一律記為 `BLOCKED`／`PENDING`。

---

## 目前結論（2026-09-23）

**Integrated：否。**

真實使用者流程目前能走到哪一步：

```text
首頁 ✅（程式可建置；部署環境目前暫停，未能實測）
↓
同意 ⛔ 停在這裡：真實模式只送出 Jerry 核准的同意版本，目前沒有 ACTIVE 版本（D-05）
↓
初步評估 ⛔ 後端一律回 KNOWLEDGE_UNAVAILABLE（B-008 未做、無 PUBLISHED 知識）
↓
推薦 ⛔ API 不存在（B-005 未開始）
↓
服務單位詳情 ⛔ API 未合併（B-004 PR #16 需修正）；前端頁面未開始（C-004）
↓
送出媒合 ⛔ API 不存在（B-006）；前端未開始（C-005）
↓
內部查件與狀態更新 ⛔ 未開始（B-006 補充、LEAD_OPERATIONS）
```

另外：**Netlify 團隊額度用完，`kareo-tw` 與 `kareocar` 兩個站都暫停中**（MVP_DECISIONS D-09），所以任何部署後驗收目前都無法執行；Kareocar 交通外連的目標頁也暫時無法使用。

---

## 執行紀錄

### Run 2026-09-23-01 — 本機，J-003-r1 分支

| 項目 | 內容 |
|---|---|
| Base commit | staging `9d5f72c` |
| 環境 | 本機 macOS，Node v24.19.0（CI 使用 Node 22，同 netlify.toml） |
| 資料／知識版本 | 無 Provider 匯入、無 PUBLISHED Knowledge |
| 真實外部服務 | 未使用（Supabase 憑證不在本機；Netlify 暫停） |

| # | 檢查 | 指令 | 結果 |
|---|---|---|---|
| 1 | Backend typecheck | `npm run typecheck --prefix apps/api` | PASS |
| 2 | Backend tests | `npm test --prefix apps/api` | PASS（5 檔、34 項） |
| 3 | Frontend build（real 模式） | `npm run build --prefix apps/web` | PASS；bundle 內無 `MOCK` 字樣（mock 已被移除） |
| 4 | Netlify site bundle | `node scripts/build-site.mjs` | PASS |
| 5 | 路由／mock／禁止欄位／端點覆蓋 | `node scripts/check-integration.mjs` | 7 PASS、4 PENDING、0 FAIL |
| 5a | 同上，用 staging 原本的 netlify.toml | 同上 | **FAIL**：`externalServiceTransportation` 無路由（B-007 已合併但打不到）→ 本 PR 修正 |
| 5b | 負向：mock 加入 `officialCMSLevel` | 同上 | FAIL（如預期） |
| 6 | 知識內容包 | `node scripts/validate-knowledge-pack.mjs .` | PENDING（J-002 PR #19 未合併）；在 J-002 分支上 PASS，負向測試 FAIL 如預期 |
| 7 | Provider 資料 gate | `node scripts/check-provider-data.mjs` | PENDING（A-004 未合併；且目前版本會假通過，見 PR #18 review） |
| 7a | Real 模式 UI（本機 `vite preview`，無後端） | Chrome：同意頁勾選 →「同意並開始評估」 | 顯示「系統回應異常，請稍後再試或直接聯絡 1966。」並停留在同意頁；**沒有**以 mock 放行到評估頁 |
| 8 | Netlify ignore | `CACHED_COMMIT_REF=… COMMIT_REF=… node scripts/netlify-ignore.mjs` | 純文件範圍 → 跳過（exit 0）；含 `.gitignore`／程式 → 建置（exit 1）；無 ref → 建置 |

端點覆蓋（第 5 項）：

| Endpoint | 狀態 |
|---|---|
| POST /api/v1/session | 有路由與 function |
| POST /api/v1/consent | 有路由與 function |
| POST /api/v1/assessments | 有路由與 function（回 KNOWLEDGE_UNAVAILABLE） |
| GET /api/v1/external-services/transportation | 本 PR 補上路由 |
| POST /api/v1/recommendations | PENDING — B-005 |
| GET /api/v1/providers/{providerId} | PENDING — B-004（PR #16） |
| POST /api/v1/leads | PENDING — B-006 |
| GET /api/v1/knowledge/status | PENDING — B-008 |

---

觀察：同意頁文案仍標示「MVP Mock 文案」，需 C 依 PRIVACY_AND_RETENTION §8 更新（核准前可用 DRAFT 並明示）。

## 完整 E2E 驗收清單（尚未執行）

每一項需記錄：commit、環境、Provider 資料版本、Knowledge 版本、日期、步驟、實際結果、截圖（不含真實個資）。

### 主流程

- [ ] 新 session → 同意（ACTIVE 版本）→ 真實 Assessment（PUBLISHED 知識＋規則引擎 `RULES-*`，ASSESSMENT_RULES §9 案例抽測）
- [ ] Recommendation：3 家、2 家、1 家、0 家（空狀態文案，不是錯誤）
- [ ] Provider 詳情 → Google Maps 連結來自資料，不由前端組 URL
- [ ] Lead 送出（含聯絡同意）→ 資料庫可查 → 接件人工具可看到 → 狀態更新 NEW→CONTACTED→ACCEPTED→CLOSED
- [ ] Kareocar：另開分頁到 `https://kareocar.netlify.app/`，無 iframe

### 錯誤與邊界

- [ ] 拒絕同意／同意撤回後不能評估、不能送 Lead
- [ ] 無 PUBLISHED 知識 → KNOWLEDGE_UNAVAILABLE，畫面不顯示假結果
- [ ] 規則引擎：同一輸入重複送出結果相同；「不需要輪椅」等否定句不觸發關鍵字
- [ ] 網路中斷後重試成功，不產生重複資料
- [ ] Lead 重複送出（同一 Idempotency-Key、連點）→ 只有一筆
- [ ] 跨 session：用 session B 的 token 讀寫 session A 的 assessment／lead → 被拒
- [ ] 偽造／過期 token → SESSION_INVALID
- [ ] 限流：超過上限 → RATE_LIMITED，多次請求不能繞過
- [ ] 未知 API → JSON 404，不回首頁 HTML

### 裝置

- [ ] 手機（約 375px）、平板、桌機可完成主流程
- [ ] 鍵盤可完成主流程（skip link、表單、按鈕）

---

## 首次知識發布（待執行）

條件：PR #19 合併、Jerry 核准 `KP-2026-09-23-001` 內容（逐筆）、B-008 合併。

| 項目 | 紀錄 |
|---|---|
| 內容包與核准 PR | （待填） |
| 匯入指令與輸出 | （待填） |
| 核准／發布操作者 | （待填，真實人員） |
| KnowledgeVersion | （待填） |
| `GET /api/v1/knowledge/status` 回應 | （待填） |
