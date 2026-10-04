# TASK-C-008 — Knowledge Info Page（長照制度與補助資訊頁）

Owner: Engineer C — Frontend  
Status: MERGED（#65）；公開長照資訊 UI／契約類別已交付，B-014 已接線；真實部署查詢待 J-003。（2026-10-04 J-003-r12 核對）
Plan revision: 2026-10-01 / J-002-r8（MVP_DECISIONS D-19 Q3，[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)；PRODUCT_SPEC §14c；API_CONTRACT §13a）

## Goal / 目標

讓使用者不必先做評估，就能瀏覽已審核發布的長照制度與補助資訊，並清楚知道這是制度說明、不是個人資格判斷。

## Allowed Paths

```text
/apps/web/**
```

## Deliverables

- 頁面（例如 `/info`）：首頁次要入口「長照制度與補助資訊」連到此頁（PRODUCT_SPEC §53）。
- 篩選：適用地區（全部／全國／臺北市／新北市）、類別；分頁。
- 每筆顯示標題、摘要（照原文逐段顯示，不改寫）、發布機關、來源連結（`source.url` 為 `null` 時只顯示名稱與機關）、生效日；頁面顯示知識版本與 `notice` 原文。
- 頁面底部提供「開始免費長照評估」與 1966 提醒（PRODUCT_SPEC §34）。
- `KNOWLEDGE_UNAVAILABLE` 時顯示「目前沒有可用的已發布資訊，請稍後再試或聯絡 1966」，不得顯示假資料。
- loading、empty、error、RWD、鍵盤操作；`mockAdapter`／`realAdapter` 依 §13a。

## 用詞規則

不得出現「您符合」「已核定」「您可獲得」；不自行計算或推論任何金額或資格。

## Acceptance Criteria

- [ ] `contracts/mock/knowledge/` 每個成功、空結果、錯誤情境都有對應畫面
- [ ] 沒有網址的來源不顯示連結
- [ ] 用詞檢查自動化
- [ ] 既有前端測試全部通過；real API 模式 build 通過

## Not In Scope

個人化建議、搜尋全文、管理功能、修改評估結果頁。

## Submission / Completion

Branch：`feat/c-008-knowledge-info-page`　Submission Version：`C-008-r1`　PR → `staging`，引用 Issue #49  
PR Title：`[C-008] Knowledge info page`

## 變更紀錄

- 2026-10-01 J-002-r8：依 D-19 Q3 建立。
