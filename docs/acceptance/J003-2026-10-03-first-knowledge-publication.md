# J-003-r9：首次知識發布與真實 API 驗證

日期：2026-10-03（Asia/Taipei）  
目標：Kareo／https://kareo-tw.netlify.app  
驗證部署：`376f3ef36d0e87871a780328de80c324881edd6a`  
結論：**Integrated = 否**。本紀錄是部分驗證，不是完整 MVP 驗收。

## 已執行的雲端操作

Supabase 專案 `ojawadobnaxduxybqolk`（Kareo，Tokyo）。沿用 Jerry 已核准的五個知識包，21 筆 APPROVED 內容；另 1 筆 REJECTED 未匯入。

先以正式 `importContentPack`、`parseSourceRegistry`、`runApproveKnowledgePack` 做離線核對，捕捉正式 `SupabaseKnowledgeRepository.insertRecords` 的資料映射，未取得雲端憑證。再透過 Supabase 連線工具執行一個 transaction：

1. 使用 service_role，鎖定 sources／records／versions；確認三表原先皆空，否則中止。
2. 匯入 18 個實際使用的完整 Source Registry 來源及 21 筆 NEEDS_REVIEW 紀錄。
3. 只在 ID、狀態及預期 content fingerprint 一致時，套用既有核准；檢查更新筆數必須為 21。
4. 呼叫既有 `public.publish_knowledge_version`，檢查 21 筆發布及版本成員後提交。

這是正式服務的前置驗證、資料映射與雲端 RPC transaction，**不是完整 CLI 在雲端執行的證據**。沒有新增法律簽核，沒有自動核准新爬取內容。

結果：`KB-2026-09-24-001`，18 sources／21 PUBLISHED records／21 version members。發布時間為 `2026-10-02T21:57:38.819773+00:00`（台灣 10/03 05:57:38）。`lastVerifiedAt` 保留原始 `2026-09-24T08:25:01+00:00`，不代表今天重新核對官方來源。

公開 `GET /api/v1/knowledge/status` 回 200 並讀到該版本；Provider 詳細及 transportation API 亦回 200。這些是可用性探測，不代替完整案例。

## 真實資料庫回滾

呼叫實際 `import_provider_dataset`，先插入合成 Provider，再以不存在的 provider_id 插入 Service，觸發 foreign key violation。只捕捉該例外，確認 Provider 插入亦回滾。沒有保留測試列；資料仍為 30 providers／30 services／86 service areas。此項證明晚期失敗的原子回滾，並非僅在寫入前拒絕。

## 真實 API E2E

執行既有 `tests/e2e/run-api-e2e.mjs`，開始及結束均以 `kareo-version.json` 確認相同部署 commit。原始結果存於 `tests/e2e/results/api-2026-10-03-foundation.json`；不更改其中目標 commit。

時間：台灣 10/03 06:03:53～06:04:14。Runner 記錄 21 個案例：4 PASS、0 FAIL、17 PENDING。

| 通過 | 實際證據 |
|---|---|
| E2E-01 | 真實 Session 建立，token 長度及 expiresAt 符合契約 |
| E2E-03 | 未同意時拒絕評估，403 CONSENT_REQUIRED |
| E2E-17 | 偽造 token 被拒絕，401 SESSION_INVALID |
| E2E-21 | 未知 API 回 404 NOT_FOUND |

完整清單現在有 **49 個必要案例**（原 43 個保留，依已核准 D-18／D-19 補 E2E-44～49）。對這個部署只取得 4 項 PASS，完整範圍仍有 45 項未通過；runner 的 17 PENDING 不是全專案剩餘數量。

D-05 仍 DRAFT，沒有同意、評估或 Lead 寫入。部分已存在的 recommendation／Lead 路由尚缺 runner 的完整驗收步驟；不應一律解讀成端點不存在。DELETE session 回 400 INVALID_REQUEST，尚不可驗收；transportation API 成功亦未證明 UI 新分頁行為。

Runner 建立三個合成 Session。外部 wrapper 原預期 finally 記錄 ID，但 runner 使用 process.exit，故沒有取得清理 ID，**沒有刪除成功證據**，不採計 E2E-37。它們沒有同意、評估、聯絡或健康資料；不得以時間區間批次刪除可能屬於訪客的 Session。

證據只屬上述 commit。後續合併或部署後須重跑，不將舊 PASS 移植到新版本。

## 開發與發布檢查

- check-integration：12 PASS／13 PENDING／0 FAIL。
- dev gate（未載入本次結果時）：48 PASS／0 FAIL／64 PENDING，exit 0 不是 MVP 通過。
- release gate 指定上述部署並載入本次 E2E：52 PASS／0 FAIL／60 PENDING，輸出 RELEASE GATE FAILED。52 包含資料／開發檢查與 4 項 E2E，不是 52 項 E2E。
- 真實 release smoke：首頁、部署 commit、已發布知識、未知 API 四項通過。這不是完整 E2E 或 J-004 完成。

## 剩餘阻擋與順序

1. B-011b #55：修正後驗收撤回、DELETE session、保存期限與清理；再完成 D-05 技術檢查及最終審閱。不得先啟用 DRAFT 同意。
2. B-012 #48：修正內容包核准規則與 migration 衝突，再跑管理發布／撤回與稽核 E2E。
3. B-013 #57 → C-007 #58：依契約整合公開資源查詢；A-007、B-014、C-008、C-009 尚未見 PR。
4. 補齊既有已部署業務流程的 API／UI 驗收，使用合成資料並記錄精確部署版本及清理結果。
5. 每日 crawler 尚未運行：workflow 只在 staging，main 尚無該檔。GitHub 已建立 staging environment，僅允許 staging 分支，沒有 secrets。需先準備符合發布規則的 workflow，再由 Jerry 確認 GitHub 可取得資料庫 service-role 憑證；不能把 secret 寫在文件、PR 或聊天。排程將寫入待審變更，不自動發布。
6. 全部 49 必要項目通過後才可標 Integrated；正式發布與 J-004 另行驗收。
