# Kareo Release Runbook / 發布與維運手冊

Owner: Jerry（TASK-J-004）
Submission Version: J-004-r2
Status: DRAFT — 尚未演練

> 本手冊的每個步驟都要在 10/20–10/21 的發布演練中實際跑過一次，並把結果填入 §7。
> 未演練過的步驟不得視為可用。

---

## 1. 責任分工

| 職責 | 主要 | 備援 | 需要的權限 |
|---|---|---|---|
| 發布（Release PR、合併 main） | Jerry | （待指定） | GitHub admin |
| Netlify 部署／回滾 | Jerry | （待指定） | Netlify team member |
| 資料庫 migration／備份／還原 | Jerry | （待指定） | Supabase project owner |
| 媒合接件 | 蘇子傑（週一至週五 09:00–21:00） | 不設；無法接件時暫停入口 | InternalOperator 個人密鑰 |
| 告警處理 | Jerry | （待指定） | 同上 |
| 刪除請求 | （待指定） | Jerry | InternalOperator `DATA_STEWARD` |

交接時確認每個人**實際登入並執行過一次**自己的操作，不以口頭承諾代替。

## 2. 發布步驟

1. 確認 `docs/RELEASE_CHECKLIST.md` Gate 0–6 全部勾選並附證據。
2. 在 staging 固定 release commit，執行完整 CI（綠燈）。
3. 備份 production 資料庫（Gate 6）。
4. 依序對 production 套用新 migration，每支之後跑權限測試。
5. 建立 `staging → main` Release PR，標題含版本號；Jerry review 後合併。
6. 等 Netlify production deploy 完成，記錄 deploy ID。
7. 執行發布後 smoke（§3）。
8. 全數通過 → 開放正式媒合入口；任一失敗 → §4 回滾。
9. 在 §7 記錄結果。

## 3. 發布後 smoke（合成資料）

```text
node scripts/smoke-release.mjs --base-url=https://<production-site> --commit=<完整40位release SHA> --knowledge-version=<本次預期KB版號>
```

此腳本只使用 GET，確認首頁、部署 commit、知識版號及 JSON 404，不建立任何 Session／Consent／Lead，也不代表完整 MVP E2E。舊 smoke-staging.mjs 使用 deployment-smoke-test 同意版本且沒有 session token，不可再作為正式發布 smoke。

另外人工確認：

- [ ] 首頁、同意、評估、結果、推薦、詳情、Lead 表單在手機可操作
- [ ] 用合成資料送出一筆 Lead → 接件人工具看得到 → 標記 `CANCELLED`（`INVALID`）並清除
- [ ] `GET /api/v1/knowledge/status` 為預期版本
- [ ] 未知 API 回 JSON 404
- [ ] Kareocar 新分頁開啟

smoke 產生的合成資料必須清除或標註，不得混入正式統計。

## 4. 回滾

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
