# J-003-r17 — Staging crawler runtime repair

Date: 2026-10-06 (Asia/Taipei). Base: staging `5b3cd0def6b63ad00da4e1dd952b6909ce490482`.

## Actual environment observations

Jerry saved `SUPABASE_SERVICE_ROLE_KEY` in GitHub environment `staging`; both it and `SUPABASE_URL` were verified by name only. Secret values were not extracted. Jerry agreed to changing the default branch to `staging` and a crawler trial. GitHub subsequently showed `Default branch changed to staging`. `main` remains the production release branch; no release merge occurred.

First manual run: https://github.com/viz963-1216/Kareo/actions/runs/37433620704 (workflow_dispatch, staging `5b3cd0d`, 2026-10-06 08:03:56–08:04:34 UTC). Preconditions, dependency installation and build succeeded. Crawler failed. The acceptance database `ojawadobnaxduxybqolk` recorded 11 FAILED CrawlerRuns, 0 snapshots and 0 changes. PUBLISHED version remained `KB-2026-09-24-001`.

Two concrete causes:

1. `crawlSource` inserted a snapshot before its parent CrawlerRun. Migration 0017 has an immediate `crawler_snapshots.crawler_run_id → crawler_runs.id` foreign key, so this cannot succeed in the actual database. The previous in-memory tests did not enforce this constraint.
2. Active registry source `SRC-LAW-L0070040` has no imported knowledge record and was absent from `knowledge_sources`. The fallback FAILED run therefore also violated its source foreign key and stopped the remaining sources.

## Repair

- Create a RUNNING row before snapshot writes, then finish the same id via repository upsert. Snapshot/repository errors finish that same row as FAILED; a saved snapshot stays linked. No separate fallback success or stranded RUNNING is intentionally created.
- Before the CLI crawl, register missing active official sources from the approved Source Registry. Validate ids, authority, jurisdiction and government URL. Insert conflicts are ignored, preserving existing source metadata; inactive and KAREO_DRIVE sources are excluded. No KnowledgeRecord, review or published version is created by registration.
- Retain the source name while parsing the existing registry table. This is internal metadata, not a public API change.
- Update the workflow comment to reflect the actual default branch. Cron stays `10 16 * * *` UTC (00:10 Asia/Taipei); existing concurrency and timeout remain.
- No schema migration, RLS change, paid service, new source, knowledge approval, consent activation or health/Lead operation.

## Verification and limits

Local backend typecheck and build: PASS. Full backend suite: 54 files, 753 tests PASS (2026-10-06 16:10:29 Asia/Taipei, 103.14 seconds). The earlier run found the registry parser's now-outdated expected object; the test was updated to verify the retained source name, and the complete suite was rerun. No test was removed.

`apps/api/tests/crawlerDatabase.test.ts` uses actual migrations 0006/0015/0016/0017 in PGlite and the actual SupabaseKnowledgeRepository write payloads through a local SQL bridge. It tests missing-source registration and repeat preservation, first crawl with no baseline, exact snapshot bytes/hash and both foreign-key links, same-id failure completion, invalid-source rejection, and a negative control for the original snapshot-before-run SQL failure. This is local SQL verification; the bridge does not prove actual HTTP/PostgREST or deployment behaviour. Existing crawler/hash/deduplication/import tests remain.

The first failed run remains evidence. Post-fix cloud results will be recorded with their actual run URL, commit and database observations; they are not assumed here. A manual trigger is not a scheduled midnight trigger. E2E-26/38/39 and the complete 49-case release gate are not marked PASS by this repair. Integrated remains false.

Scope: Jerry's central repair of B-009 runtime and J-003 workflow/evidence, under the instruction to complete ABCJ tasks. No frontend, assessment, recommendation or consent business rules changed.
