# TASK-C-005 — Lead Flow + Final MVP UX QA

Owner: Engineer C — Frontend  
Type: Frontend / Assessment Result / Location / Lead / UX  
Status: **READY**（C-004 已合併，PR #27）；未見提交  
Plan revision: 2026-09-23 / J-002-r4

---

# Goal / 目標

完成原始 MVP 使用者流程中前端尚未承接的部分，並以 **Mock 模組驗收**（`VITE_KAREO_API_MODE=mock`）證明畫面與 contract 相容：

1. **結果頁的制度與補助說明**（PRODUCT_SPEC §1、§3、§14、§34）：逐行顯示 `summary`（含 S-SUB-*、S-LOCAL-*）、顯示 `knowledgeVersion`、1966 正式評估提醒。
2. **三種位置情境**（PRODUCT_SPEC §21–24）：精確位置、只有行政區（含只有縣市）、不提供位置；GPS 拒絕／失敗的備援。
3. **推薦畫面依 `rankingType`**：DISTANCE、DISTRICT_ROTATION（含精確位置缺座標改行政區）、CITY_ROTATION、NO_LOCATION／不呼叫。
4. **我要媒合（Lead）**與全站 UX 收斂。

真實 API 的端對端驗收由 J-003 執行，不在本任務。

---

# Prerequisite / 前置條件

- C-004 已合併（完成）。
- Contract：API_CONTRACT v0.2.2 §8（location、summary 格式）、§9（位置與排序）、§12（Lead）。
- Mock fixtures：`contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json`、`contracts/mock/recommendations/**`（含 `ranking-variants/` 五種情境）、`contracts/mock/lead-response.json`（說明見 `contracts/mock/README.md`）。
- D-13a–g、D-14a–b 已核准（2026-09-24）。同意與位置告知文案（D-05）仍為 DRAFT：可依此排版，正式上線與正式收集座標需 ACTIVE 版本。

---

# Branch / PR Rule

從最新 `staging` 建立 `feat/c-005-lead-final-ux`，完成後 PR → `staging`。  
首次提交版次：`C-005-r1`。

# Allowed Paths

```text
/apps/web/**
```

---

# Required Deliverables

**A. 結果頁：可能適用的制度與補助**

- `summary` 以 `\n` 分行，每行一段；不解析內容、不自行計算或補上任何金額、比率或政策文字。
- 顯示回應中的 `knowledgeVersion`（例如「資料版本 KB-…」）。
- 保留 1966 正式評估提醒與 warnings。

**B. 評估頁：位置輸入**

- 縣市選項：臺北市、新北市、「其他縣市／不提供」（D-14b）；行政區選擇（依縣市）。
- 「使用目前位置」：使用者主動點選才呼叫瀏覽器定位；顯示位置告知（PRIVACY §8「位置資訊」DRAFT）；取得後仍需選縣市與行政區（D-13d）；送出 `precision = GPS` 與座標。
- GPS 拒絕／逾時／不支援：顯示原因，回到縣市／行政區選擇；使用者可選「不提供位置」；**評估不中斷**。
- 依 precision 送出正確的 `location`（API_CONTRACT §8：不適用欄位為 `null`，不省略）。
- 正式啟用開關（D-13g）：同意版本涵蓋位置前，正式環境不顯示「使用目前位置」；以部署設定控制（預設關閉），Mock 模式可開啟驗收。

**C. 推薦畫面**

- 依 `rankingType` 顯示對應說明；`distanceKm` 只在 API 提供數值時顯示；notice 原文顯示。
- `precision = NONE` 時不呼叫推薦 API，顯示服務建議與「補充位置」入口（回到評估頁位置欄位重新送出，D-13b）。
- 0／1／2／3 家與 Empty State；TRANSPORTATION 維持 Kareocar 新分頁 CTA。

**D. 我要媒合（Lead）**

- Lead Form：稱呼、電話、媒合聯絡同意勾選（PRIVACY §3.4）；name／phone validation。
- 帶入所選 Provider／Service／recommendationId；`Idempotency-Key` 與 token 由 API adapter 處理，UI 不直接處理 token。
- 送出期間防重複點擊；失敗可重試且不顯示假成功；成功以 API 回覆為準，文案不宣稱已完成媒合。

**E. 全站 UX**

- 同意頁、清除／重新開始 session、DRAFT 文案標示（正式版本由部署設定讀取，不寫死）。
- Mobile／Tablet／Desktop；Keyboard／label／focus；LOADING／SUCCESS／EMPTY／ERROR 一致化。
- 健康回答、座標、姓名電話、token 不進 URL 或 console，不長期保存於 localStorage。

---

**F. 身心障礙證明選填題（2026-09-24，D-17；PR #34 開立後新增，需以修正版提交）**

- 評估頁新增「是否領有身心障礙證明」：是／否／不確定（預設不確定），附一句說明「只用來顯示您可能適用的補助」。
- 送出 `disabilityCertificate`；結果頁照常逐行顯示 summary（以 `WITH-DISABILITY-NEW_TAIPEI.json` 驗收）。

# Acceptance Criteria（Mock 模組驗收）

- [ ] 結果頁以 `WITH-SUBSIDY-NEW_TAIPEI.json` 逐行顯示補助說明與 `knowledgeVersion`；程式碼中沒有任何政策金額或比率
- [ ] 位置：GPS 成功、GPS 拒絕→選行政區、只選縣市、選「其他縣市／不提供」四條路徑都能完成評估，送出的 `location` 符合 §8
- [ ] 推薦：DISTANCE、DISTANCE-MISSING-COORDINATES、DISTRICT_ROTATION、CITY_ROTATION 各有正確畫面；NONE 不呼叫 API
- [ ] 除 DISTANCE 外不顯示距離；任何畫面不出現「最近」「附近」
- [ ] 0／1／2／3 家與 Empty State
- [ ] 身心障礙證明選填題三個選項都能送出；結果頁以 `WITH-DISABILITY-NEW_TAIPEI.json` 顯示身心障礙福利補助段落
- [ ] Lead Flow 可用 Mock 完成；連點只送出一次；失敗可重試
- [ ] 正式資格用語維持「預估／可能」；1966 提醒出現在評估前、結果、補助說明、推薦與頁尾（PRODUCT_SPEC §34）
- [ ] RWD 與 Keyboard 基本通過；不直接連 Supabase；不修改 Backend／Contract
- [ ] PR 標示「Mock 驗收」；真實 API E2E 欄位留給 J-003

---

# Not In Scope

Backend Lead、CRM、Payment、Production Deploy、地址轉座標（EXACT，待 D-13d）、補助計算器、真實 E2E。

# Completion Report

PR 必須包含 Submission Version、Added / Changed / Fixed、Tests、Known Issues、Scope Check。

PR Title：`[C-005] Lead Flow + Final MVP UX QA`

---

# 變更紀錄

- 2026-09-19：補隱私／同意版本、session 清除、防重複與不顯示假成功。
- 2026-09-23 J-002-r3：加入位置三情境與驗收分層。
- 2026-09-23 J-002-r4：補充整併進主文；新增結果頁補助說明顯示（承接原指向已完成 C-002 的工作）；GPS 取得畫面不再等待 D-08（已擱置），改以 D-13g 開關控制正式啟用；新增 CITY_ROTATION、缺座標、NONE 畫面與 fixtures。
