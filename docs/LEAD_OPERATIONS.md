# Kareo Lead Operations / 媒合接件作業規格

Submission Version: J-002-r4
Owner: Jerry
Status: PROPOSED（D-06）；主要接件人已指定（蘇子傑，2026-09-24）；**備援接件人尚未指定（BLOCKED）**

> 本文件定義「使用者送出我要媒合之後，由誰、用什麼方式、在多久內處理」。
> MVP 不建立 CRM 或商家後台；接件使用受保護的內部指令。
> **在 §2 的接件人由真人擔任並完成 J-004 實演之前，不得對外開放正式媒合。**

---

## 1. MVP 媒合模式

```text
使用者送出「我要媒合」（含聯絡同意）
↓
Lead = NEW
↓
Kareo 接件人致電使用者：確認需求、確認可轉告服務單位
↓ 聯繫成功
Lead = CONTACTED
↓
接件人聯繫推薦的服務單位，確認對方願意與使用者聯絡
↓ 服務單位同意
Lead = ACCEPTED
↓
確認使用者與服務單位已建立聯繫，或使用者表示不再需要
↓
Lead = CLOSED
```

- 服務單位**不會**自動收到使用者資料；轉告前必須取得使用者同意（PRIVACY_AND_RETENTION §3.4）。
- Kareo 不代收費用、不代簽約、不保證服務單位接案。

## 2. 角色與責任

| 角色 | 人選 | 責任 | 權限 |
|---|---|---|---|
| 主要接件人（Lead Operator） | **蘇子傑**（Jerry 本人，2026-09-24 於 J-002 對話中指定自己擔任；服務時段 09:00–21:00） | 依 §5 時程聯繫、更新狀態、記錄結果 | `lead:list`、`lead:show`、`lead:reveal-contact`（被指派案件）、`lead:update` |
| 備援接件人 | **待 Jerry 指定**（RELEASE_CHECKLIST Gate 3 要求 Jerry 以外至少一人可操作） | 主要接件人休假或超過時限時接手 | 同上 |
| 資料管理者 | Jerry | 指派／撤銷接件人權限、稽核存取紀錄、處理刪除請求 | 全部，含 `operator:*` |

- 操作者名單存於資料庫 `InternalOperator`（DATA_MODEL §36），以操作者 ID＋個人密鑰驗證；**不使用共用帳號**。
- 權限異動需留紀錄；離職或不再擔任時立即撤銷。

## 3. 狀態與允許的轉移

Lead Status 沿用 API_CONTRACT §12：`NEW`、`CONTACTED`、`ACCEPTED`、`CLOSED`、`CANCELLED`。

| 從 → 到 | 條件 | 必填原因碼 |
|---|---|---|
| NEW → CONTACTED | 已與使用者通話並確認需求 | — |
| NEW → CANCELLED | 使用者撤回、同意撤回、資料刪除、3 次無法聯繫、明顯無效或重複 | `USER_WITHDRAWN`／`CONSENT_WITHDRAWN`／`USER_DELETED`／`UNREACHABLE`／`INVALID`／`DUPLICATE` |
| CONTACTED → ACCEPTED | 服務單位同意與使用者聯絡 | — |
| CONTACTED → CLOSED | 使用者不再需要，或改由其他管道處理 | `NO_LONGER_NEEDED`／`REFERRED_ELSEWHERE` |
| CONTACTED → CANCELLED | 使用者撤回或刪除資料 | 同上 |
| ACCEPTED → CLOSED | 已建立聯繫，或服務單位最終無法提供 | `CONNECTED`／`PROVIDER_UNAVAILABLE` |
| ACCEPTED → CANCELLED | 使用者撤回或刪除資料 | 同上 |

- `CLOSED`、`CANCELLED` 為終態，不得再轉移。
- 其他轉移（例如 NEW → ACCEPTED、CLOSED → NEW）一律拒絕，回 `INVALID_STATUS_TRANSITION`。
- 每次轉移寫入 `LeadStatusEvent`（誰、何時、從哪到哪、原因碼、**不含個資的備註**）。

## 4. 內部查件工具（B-006 實作）

受保護的 CLI，於操作者本機以安全環境設定執行（不提供公開管理 endpoint）：

```text
npm run lead -- list   [--status NEW] [--since 2026-10-01]
npm run lead -- show   <leadId>              # 不含電話
npm run lead -- reveal-contact <leadId>       # 顯示稱呼與電話，並寫入存取紀錄
npm run lead -- update <leadId> --to CONTACTED [--reason CODE] [--note "..."]
```

規則：

- 每個指令都驗證操作者身分與權限；失敗回非零狀態。
- `list`／`show` 不輸出電話；只有 `reveal-contact` 顯示，且寫入 `LeadAccessEvent`。
- 指令輸出與 log 不得包含自由文字原文、健康細節或電話（`reveal-contact` 的畫面輸出除外，不寫入 log）。
- 併發更新以「目前狀態」作為條件更新（compare-and-set），避免兩位操作者同時改動。

## 5. 回覆時程（建議，需 Jerry 核准）

服務時段：**09:00–21:00**（Asia/Taipei；主要接件人蘇子傑 2026-09-24 提供）。**適用日別（每天或僅週一至週五、國定假日是否服務）尚未確認**；確認前，對外文案不得寫出日別。回覆時程中的「工作天」定義隨日別確認。

| 指標 | 目標 |
|---|---|
| 首次聯繫（NEW → CONTACTED 或第一次嘗試） | 1 個工作天內 |
| 無法聯繫 | 3 個工作天內於不同時段嘗試 3 次，仍失敗 → `CANCELLED`（`UNREACHABLE`） |
| 服務單位回覆（CONTACTED → ACCEPTED／CLOSED） | 3 個工作天內 |
| 超過時限 | 備援接件人接手；每日第一件事檢查逾時案件 |

新案件通知：MVP 由接件人每個工作天上午與下午各執行一次 `lead list --status NEW`。如需即時通知（email 等），另行決策，不在本版範圍。

使用者看到的文字需與實際承諾一致。日別確認後，例如：「Kareo 服務人員將於 1 個工作天內（{日別} 09:00–21:00）致電與您確認需求。」

## 6. 重複送出

- 前端每次送出帶 `Idempotency-Key`（API_CONTRACT §3.3）。相同 key 重送回傳原案件，不新增。
- 同一 session＋同一 Provider＋同一服務類型，在尚未終態的案件存在時再次送出 → 回傳既有案件（`200`，`duplicate: true`），不新增。
- 接件人發現跨 session 的重複（同一電話同時多件）可將多餘案件 `CANCELLED`（`DUPLICATE`）。

## 7. 失敗處理

| 情境 | 處理 |
|---|---|
| Lead 寫入失敗 | API 回錯誤，前端提示重試；不得顯示「已送出」 |
| 接件人無法取得資料（工具故障） | 通知 Jerry；超過 1 個工作天未恢復，暫停對外媒合入口（J-004 開關） |
| 使用者要求刪除 | 依 PRIVACY_AND_RETENTION §6 |
| 服務單位資訊錯誤（電話失效等） | 記錄於 Lead 備註（無個資），通報 Engineer A 修正 Provider 資料 |

## 8. J-004 實演驗收（摘要）

- 使用合成 Lead（非真實個資）完成：list → show → reveal-contact → CONTACTED → ACCEPTED → CLOSED；以及非法轉移被拒、未授權操作者被拒、存取紀錄產生。
- 接件人本人實際操作並簽認可承諾的時段與時程。
