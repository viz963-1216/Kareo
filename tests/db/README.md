# 資料庫驗證

`verify-db.mjs` 使用隔離 PGlite，驗證 migration、權限與實際 repository 行為。`verify-concurrency.mjs` 使用真正 PostgreSQL 17 的三個獨立連線，證明跨交易共同鎖與舊預覽／撤回目標檢查；兩者不能互相代替。

## 真正 PostgreSQL 併發

從 repo 根目錄執行。先準備**專用可丟棄** PostgreSQL 17，固定資料庫 `kareo_concurrency_test`、帳號 `kareo_test`、loopback 監聽。腳本會 DROP／重建 public schema，不得使用含有其他資料的本機庫。

```sh
npm ci --prefix tests/db
export KAREO_TEST_PG_URL='postgresql://kareo_test:synthetic-ci-only@127.0.0.1:5432/kareo_concurrency_test'
export KAREO_TEST_PG_DISPOSABLE=1
node tests/db/verify-concurrency.mjs
```

所有資料／密碼為本機合成資料，無 Supabase 憑證。CI 使用官方 `postgres:17` service，不需安裝在應用 runtime。正向預期 8 PASS／exit 0。

```sh
node tests/db/verify-concurrency.mjs --negative-control=wrong-publish-lock
```

對照預期初始化 PG-M1 通過，PG-L1 回 `FAIL PG-CONCURRENCY SHARED_LOCK_NOT_OBSERVED`／exit 1。它只修改可丟棄庫的函式，不改 repo migration。CI 同時檢查指定失敗及非零 exit，避免初始化問題被當作有效對照。

## 私人快照的內容包回填預演

```sh
npm ci --prefix tests/db
npm ci --prefix apps/api
npm run build --prefix apps/api
node scripts/rehearse-content-backfill.mjs --snapshot=/absolute/private/snapshot.json --output=/absolute/private/result.json
```

只接受現有驗收 Kareo 的應用快照；本機還原、升級、合成操作者，走實際 protected CLI／repositories／RPC。7 項檢查包含重跑、內容篡改及停用操作者。不要提交私人快照或操作者金鑰。此工具使用 loopback shim，不驗證 JWT／RLS，不算雲端回填或部署 E2E。
