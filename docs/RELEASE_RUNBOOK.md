# Kareo Release Runbook / 發布與維運手冊

Owner: Jerry（TASK-J-004）
Submission Version: J-004-r3
Status: DRAFT — 尚未演練

> 本手冊的每個步驟都要在 10/20–10/21 的發布演練中實際跑過一次，並把結果填入 §7。
> 未演練過的步驟不得視為可用。

---

## 1. 責任分工

| 職責 | 主要 | 備援 | 需要的權限 |
|---|---|---|---|
| 發布（Release PR、合併 release） | Jerry | （待指定） | GitHub admin |
| Netlify 部署／回滾 | Jerry | （待指定） | Netlify team member |
| 資料庫 migration／備份／還原 | Jerry | （待指定） | Supabase project owner |
| 媒合接件 | 蘇子傑（週一至週五 09:00–21:00） | 不設；無法接件時暫停入口 | InternalOperator 個人密鑰 |
| 告警處理 | Jerry | （待指定） | 同上 |
| 刪除請求 | Jerry（蘇子傑，沿用資料管理者責任） | 未指定 | InternalOperator `DATA_STEWARD` |

交接時確認每個人**實際登入並執行過一次**自己的操作，不以口頭承諾代替。

## 2026-10-08 公開查詢發布

已由 Jerry 授權 release 公開查詢恢復，完整營運步驟仍待驗。日常feature→staging審查與CI；集中建立staging→release PR，公開限定範圍保留。完整 Release gate 仍會檢查49項E2E及D-05，不隱藏失敗；只有公開查詢更新可以依營運者限定授權發布，不能據此啟用個案流程。

## 2. 發布步驟

先填 RELEASE_CHECKLIST 的固定目標表。整合／正式資料庫未隔離時不執行正式 migration；目前 kareo-tw 的 Netlify production context 從 release 部署，但仍使用驗收資料庫，不能當成隔離的 production。

下列先固定待發布版本，發布後改以實際 release merge SHA 與 marker 驗證；兩者 SHA 可不同，不能填舊 E2E 當成新版本證據。


1. 確認 `docs/RELEASE_CHECKLIST.md` Gate 0–6 全部勾選並附證據。
2. 在 staging 固定 release commit，執行完整 CI（綠燈）。
3. 備份 production 資料庫（Gate 6）。
4. 依序對 production 套用新 migration，每支之後跑權限測試。
5. 建立 `staging → release` Release PR，標題含版本號；Jerry review 後合併。
6. 等 Netlify production deploy 完成，記錄 deploy ID。
7. 執行發布後 smoke（§3）。
8. 全數通過 → 開放正式媒合入口；任一失敗 → §4 回滾。
9. 在 §7 記錄結果。

## 3. 發布後 smoke（合成資料）

```text
node scripts/smoke-release.mjs --base-url=https://<production-site> --commit=<完整40位release SHA> --knowledge-version=<本次預期KB版號>
```

此腳本只使用 GET，確認首頁、部署 commit、知識版號及 JSON 404，不建立任何 Session／Consent／Lead，也不代表完整 MVP E2E。J-003-r16 已將 smoke-staging.mjs 改為指定 SHA 的驗收入口，預設僅 GET；可選寫入需明確授權及 ACTIVE。正式發布後仍使用本節 smoke-release.mjs，不以驗收入口代替發布演練。

另外人工確認：

- [ ] 首頁、同意、評估、結果、推薦、詳情、Lead 表單在手機可操作
- [ ] 用合成資料送出一筆 Lead → 接件人工具看得到 → 標記 `CANCELLED`（`INVALID`）並清除
- [ ] `GET /api/v1/knowledge/status` 為預期版本
- [ ] 未知 API 回 JSON 404
- [ ] Kareocar 新分頁開啟

smoke 產生的合成資料必須清除或標註，不得混入正式統計。

## 4. 回滾

回滾前記：事件時間、受影響範圍、現行／目標 deploy ID、commit、schema 相容性、知識版號、入口狀態及操作者。目標 deploy ID 必須實際可選；本版不提供未驗證的 UI 點擊或命令作為已通過演練。

1. 限制受影響寫入入口，確認直接 API 也被阻擋；未交付開關時 BLOCKED，不能假稱已暫停。
2. 判斷前端／Functions 舊版是否相容現在 schema、同意版本與資料；不相容則以前向修復處理。
3. 使用符合條件的已知成功 deploy。資料庫不自動倒退、不刪資料，不在現有專案做測試還原。
4. 回滾後以目標完整 SHA 和預期知識版本跑唯讀 smoke，另驗證受影響功能及禁止寫入狀態。
5. 保存去識別證據，確認原因與資料完整性後才恢復入口；FAIL／BLOCKED 不得恢復並宣稱成功。



| 問題 | 動作 |
|---|---|
| 前端或 Functions 異常 | Netlify → Deploys → 選上一個成功的 production deploy → Publish deploy。不需重新建置。 |
| 某個 API 造成資料錯誤 | 先關閉對應入口（前端顯示整合中），再以前向修復 migration／程式修正；**不刪除 production 資料** |
| migration 失敗 | 停止發布；依備份在隔離環境確認影響；以新的相容 migration 修正 |
| 知識內容錯誤 | 依 `contracts/knowledge/README.md` §5 撤回，發布上一個正確版本；無正確版本時系統回 `KNOWLEDGE_UNAVAILABLE` |
| 資料外洩疑慮 | 立即輪換相關 secret、關閉入口、保存紀錄，由 Jerry 依法規評估通報 |

## 5. 額度與告警

| 事件 | 動作 |
|---|---|
| Netlify 額度接近上限 | 停止非必要部署；文件 PR 已由 ignore 跳過建置 |
| Netlify 額度用完（網站暫停） | 網站無法服務；由 Jerry 決定購買額度或等待週期重置；對外公告暫停與 1966 管道 |
| Supabase 用量接近上限 | Jerry 評估升級或清理；不刪除正式資料 |
| 接件逾時 | 不設備援接件人（Jerry 2026-09-24 決定）；主要接件人無法處理時暫停對外媒合入口；自動逾時門檻待 Jerry 核准，不將草案時限當成既定 SLA |

## 6. 例行維護

| 頻率 | 工作 | 負責 |
|---|---|---|
| 每個工作天 2 次 | `lead list --status NEW` | 接件人 |
| 每日 | 清理作業（保存期限）結果檢查 | 資料管理者 |
| 每週 | Netlify／Supabase 用量 | Jerry |
| 每週 | Functions 錯誤 log（不含個資）檢查 | Jerry |
| 每日 | 檢查 B-009 00:10 Asia/Taipei 執行結果與 NEEDS_REVIEW；失敗保留上個發布版 | Jerry |
| 每月 | 知識來源清單人工複查（不代替每日 crawler） | Jerry |
| 每季 | 備份還原演練 | Jerry |

## 7. 發布與交付紀錄

| 日期 | 版本 | release commit | Netlify deploy | Knowledge 版本 | Provider 資料版本 | smoke 結果 | 操作者 | 備註 |
|---|---|---|---|---|---|---|---|---|
| （尚無） | | | | | | | | |

## 8. 演練與可執行性界線

使用 RELEASE_REHEARSAL.md 記錄每次操作與證據。下列事項未落實前不得把步驟標 PASS：

- 媒合暫停入口：需有實際實作位置、操作方式、權限與復原方式。只隱藏前端按鈕不足以阻止直接呼叫 API，須驗證暫停時新 Lead 不會寫入、已存在案件仍可處理。目前未確認有此開關，列 BLOCKED，不編造環境變數名稱。
- 接件 CLI：待 B-006 交付後先核對實際 help 與權限，再由蘇子傑本人操作合成資料；不可把示意指令當成已驗證工具。
- 備份還原：先核實實際方案、資料庫版本與工具；只在已確認隔離的目標演練。RPO／RTO 先記實測值，可接受門檻待 Jerry 決定，不自行宣稱達標。
- 發布回滾：前一個 deploy 必須與目前資料 schema 相容；若不相容，維持入口關閉並以前向修復處理，不盲目回退 Functions。
- 不在 GitHub／截圖／log 留存密鑰、token、聯絡方式或備份內容；只記去識別的結果與受控證據位置。

## 9. 權利申請與隔離還原

權利申請依 [PRIVACY_REQUEST_RUNBOOK.md](PRIVACY_REQUEST_RUNBOOK.md) 執行。信箱收件確認不等於刪除成功；客服無 token 的管理者操作工具尚需核對交付。

備份演練先記來源 ref、備份時間、資料庫版本、目的 ref／URL、通知與排程狀態；確認目的不為來源、正式或 Kareocar，再啟動。來源 physical 備份不能假定可直接下載成 pg_dump。依當時實際方案與[Supabase 官方備份文件](https://supabase.com/docs/guides/platform/backups)選已支援方法；需要付費／新專案另由 Jerry 決定，不預先買 PITR。

隔離目標保持對外入口關閉、排程停用、不使用真實電話，不複用正式操作者密鑰。恢復後核對 schema、列數、RLS、權限、RPC、知識成員完整性，先重套備份時間之後的刪除紀錄，再核對合成已刪資料不能讀回、不能聯繫。尚未交付可重套刪除的正式工具時記 BLOCKED，不編造自訂 SQL 補過。

記錄 RPO＝復原資料的時間點與事故目標時間差，RTO＝恢復到核對完成可服務的耗時；兩者先記實测，可接受門檻未核准前不能稱達標。備份有 7 份不代表所有副本 7 天刪除，也不包括 Storage objects 的檔案復原。
