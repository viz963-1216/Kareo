# J-002-r13：工程規格收尾與交回清單

日期：2026-10-03（Asia/Taipei）
基準：staging `6c74dee39270558f19684bc3f3655451e40abaf0`
本輪結論：**工程規格與交接完成；不是完整 J-002／D-05／MVP 驗收完成。Integrated = 否。**

## 授權與範圍

Jerry 在收到 J-002 保存設計、匯入操作者與 J-003 接線建議後，指示「好那先幫我完成J002」。本輪依該授權採用前述工程方案，核對原始 PRODUCT_SPEC 與已核准 D-18／D-19；不更改一站式產品範圍、不新增法律簽核。

只修改 docs／contracts 的 Markdown 與 tasks。沒有修改 B／C 業務程式、JSON fixtures、知識包內容或同意版本；沒有操作雲端資料庫、部署或付費。

## 工程定案

| 決策 | 定案 | 正式規格 | 公開證據 |
|---|---|---|---|
| D-05a 保存與關聯 | 健康資料與案件分開清理；Lead 保留來源編號，只移除指向 Assessment／RecommendationRun 的兩個 FK；建立時仍驗證存在、歸屬、同意與推薦資格 | DATA_MODEL §22；ARCHITECTURE §20.7；PRIVACY_AND_RETENTION §2／§6 | [#55 定案留言](https://github.com/viz963-1216/Kareo/pull/55#issuecomment-5967136580) |
| D-05a 系統取消／計數 | operatorId 可為 null 僅用於系統撤回／刪除取消；真人仍記驗證 ID。終態不重複取消，聯絡欄位全部清空。補 leadsDeleted／consentsDeleted | DATA_MODEL §37／§40；API_CONTRACT §6–7 | 同上 |
| D-05a 七天期限 | 保留既有「七天內完成」；不是等七天才開始。期限、重試及實際資料列都須驗證 | API_CONTRACT §6–7；PRIVACY_AND_RETENTION §6.1 | 同上 |
| D-16c 匯入證據 | importedBy 記實際驗證操作者；CLI 重用 InternalOperator 個人密鑰與 KNOWLEDGE_PUBLISHER 角色。首次登錄證據不被重跑覆寫，回填不冒充歷史匯入 | DATA_MODEL §26b；ARCHITECTURE §21；contracts/knowledge/README §3 | [#48 定案留言](https://github.com/viz963-1216/Kareo/pull/48#issuecomment-5967136756) |
| D-16c 舊包與指紋 | 不可變規則包含未登錄舊包；改內容採新 packId／recordId，內容不變的指紋相容仍可保留。recordsFingerprint 與含版號／狀態的 packFingerprint 分工 | DATA_MODEL §26b；contracts/knowledge/README §1／§3 | 同上 |
| B-013 範圍矛盾 | 特約縣市、輔具資源中心已在 D-19 核准，不再列於 Not In Scope；住宿機構仍按既有決定延後 | TASK-B-013；PRODUCT_SPEC §14a（未修改） | [D-19 核准](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690) |

90 天／180 天／1 年／3 年是已確認的產品規劃，不代表保存必要性已通過法律審閱。Session 狀態墓碑的最少欄位與期限仍需 D-05 審閱；不得因本輪規格授權永久保存憑證或健康資料。

## 分支測試證據與限制

這些是前一輪審查時在隔離 worktree 執行的局部驗證，不是本次文件 PR 的功能驗收，也不代表雲端已更新：

| Head | 獨立重跑結果 | 證明／限制 |
|---|---|---|
| #48 r4 `e48e4f1` | backfillContentPacks、contentPackPublishRpc.pglite、adminKnowledgeService，52／52 PASS | 包核准／回填與 SQL 情境；不涵蓋本輪新增的實際操作者與未登錄舊包規則 |
| #55 r4 `3625c83` | retentionCleanup.pglite、retentionService、session、consent，44／44 PASS | 殘留／終態聯絡欄位修正；原第6天保留／第8天刪除不證明七天內完成，仍交回修正 |
| #57 r2 `cf6d56e` | providerLookupService、providersBundle，26／26 PASS | ESM／CJS 於沒有 contracts 目錄的輸出位置可載入；不涵蓋待接限流與真實 DB |
| #58 r3 `fc957ea` | 前端78／78 PASS、typecheck PASS | Mock 模組與衝突同步；不代替 B-013 真實接線 |

#48 r4 的 Netlify Preview 失敗已定位為隨機排序測試的錯誤假設，並[交回修正](https://github.com/viz963-1216/Kareo/pull/48#issuecomment-5967066221)。本輪文件核對期間作者已提交 r5 `d5b2150` 固定 session／日期；此處只記「新提交」，未把 r4 測試結果移植為 r5 通過證據。

## 交回執行與合併順序

| 負責 | 下一步 | 完成證據 |
|---|---|---|
| B／#48 | 實作 D-16c、檢查 r5 部署測試、與 B-011b 接共用限流／payload | 操作者拒絕、冪等、舊包內容拒絕、歷史內容不變、最新 head CI／Preview |
| B／#55 | 按 D-05a 修七天期限，保持已修復的資料清理／終態行為 | 截止前／截止時刻、重試、實際列數與計數；不可拿狀態標記代替清理 |
| B／#57 | 120／小時共用限流、同步及 migration 編號 | 429／Retry-After、無敏感 log、fresh／upgrade、Functions 打包與推薦回歸 |
| B／#67 | 共用限流、B-012 repository 合併／測試型別同步 | 型別／測試、公開投影、無敏感 log；真實查詢由 J 驗 |
| J-003 | #48 → #55 → #57 → #67；#58 在 #57 後。補 consentWithdraw／providers／knowledgeRecords 路由 | 路由順序、打包後執行與 CI；每份 PR 收尾通過才合併 |
| J-003 | 0019／0020 → 0021 → 0022，雲端狀態核對後套用；內容包與逐筆審核證據回填 | fresh／upgrade、多連線併發、回填冪等與已發布21筆內容不變；不改已套用 migration 歷史 |
| J-003／J-004 | 真實查詢、撤回／刪除、清理排程、權利／接件及隔離還原演練 | 固定部署 commit、合成資料、清理結果；49 必要 E2E 全部有證據 |

規格 PR 可先合併供 B 開發；它不代替 B 的模組驗收。B-012 的10條管理路由已在 #48，J 不重複新增。共用限流未到位時不將公開 API 或管理 API 的 Acceptance Criteria 勾為全部完成。

## 最新狀態與仍未完成

- 21筆知識已首次發布為 KB-2026-09-24-001，18 sources／21 version members；lastVerifiedAt 保留來源核對日期。證據：[J-003-r9](J003-2026-10-03-first-knowledge-publication.md)。本輪不發布或重新核准內容。
- 原 Netlify 額度阻擋已解除；#48 本次失敗是測試，不是帳單。供應商預算與告警仍待 J-004。
- C-008 #65、C-009 #66 已合併；A-007 未見 PR。最新任務看板已同步，舊快照標明歷史。
- 同意清單維持 DRAFT；D-05 最終審閱／資料流／權利演練／備份再刪除／正式版本回歸尚未完成。保存規格定案不等於合法性或啟用核准。
- staging／production DB 隔離、每日 crawler 執行、正式發布仍有待驗項目。既有真實4項 E2E 證據僅屬部署 `376f3ef`，不套用到新版。

J-002-r13 本輪完成的是規格與交接；正式同意啟用、完整整合及上線完成分別由 D-05、J-003、J-004 後續驗收。

## 本次文件驗證

- 五個知識包格式驗證通過：22 筆中的21 APPROVED／1 REJECTED 未改內容或狀態；格式通過不等於重新內容審核。
- 資源 fixtures：9 list responses／8 errors／11 details 一致；知識 fixtures：5 responses／4 errors 一致；admin fixtures 依正式 validator 驗證。
- 靜態 integration 檢查：12 PASS／13 PENDING／0 FAIL；這只檢查契約與路由／檔案，不是部署測試或真實 E2E，DELETE session 有路由亦不代表功能已驗收。
- 修改範圍只含13個 Markdown 文件；知識包 JSON、同意清單及全部程式／部署設定與 staging 相同。
