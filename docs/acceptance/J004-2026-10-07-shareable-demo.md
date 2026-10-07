# J-004-r10 — Separate shareable presentation

Owner decision, 2026-10-07 (Asia/Taipei): Jerry asked 「繼續執行未完成事項，另外隱私權警告問題先讓他通過，過幾天我要demo了」 and selected 「需要可分享的展示網址」 after being offered a complete fictional-case presentation environment. **DEMO_APPROVED** applies to that synthetic presentation, not formal consent activation or legal certification. The extra human customer-support rehearsal remains CANCELLED_BY_OWNER (#102).

## Scope and implementation

Central task: build and publish an independent static presentation from the existing Kareo frontend. Paths: apps/web demo-only presentation changes, scripts/build-demo.mjs, existing build-guard tests, docs/tasks. No schema, live Supabase data, real consent registry, immutable candidate/review JSON or cloud credentials change. Jerry's standing instruction to complete ABCJ authorizes these central cross-module presentation changes.

`node scripts/build-demo.mjs` builds a local static `demo-dist` artifact with existing mock fixtures. Standard site/Netlify builds reject the demo flag; real production and acceptance still use real APIs. The demo build takes only ordinary process settings, never provider credentials, and contains no Functions deployment. Upload it only to a separate named presentation site, never kareo-tw or Kareocar. This is an explicit owner-authorized presentation exception to the usual non-deployed mock rule, not a new release configuration.

The visible banner and consent/privacy pages identify fictional examples and browser-memory behavior. Fixed test contact fields are read-only, free text and real GPS are disabled, admin login is unavailable, and the matching success page explicitly says no actual case or contact was created. No unchecked consent is silently accepted. API paths return 404; HTTP headers disable form submissions, geolocation and indexing. Normal static-host network logs remain possible and are disclosed. External Maps/official-source/Kareocar links remain external and carry no assessment payload.

## Acceptance distinction

Presentation/privacy-warning readiness is approved for the synthetic demo. Formal D-05 registry stays DRAFT with activationAllowed=false and approvalConditionsSatisfied=false; no missing evidence is relabelled PASS. Published demo/browser evidence goes here, never tests/e2e/results. The 49 deployed API/DB acceptance cases, physical backup restore/copy retirement, daily schedule evidence and formal release remain separate work.

## Rebuild and walkthrough

1. Use the approved feature/staging commit, npm ci --prefix apps/web, then node scripts/build-demo.mjs locally.
2. Inspect demo-dist/kareo-demo-version.json and verify sourceCommit plus workingTreeDirty=false before publishing. No environment file, Function bundle or key goes into the upload.
3. Present a fictional person: age 65+, Taipei city / Wanhua district, needs home care and assistive devices. Follow consent → assessment → results → recommendation → detail/Maps → mock matching with fixed test contact. Show the needs summary and public resource/knowledge pages.
4. Refresh to reset the browser-memory example. It is not a saved real case. Never use the demo output as a benefits decision or a real referral.

Deployment and actual verification results will be recorded after execution.

Pre-deployment checks: frontend tests 81 PASS / 0 FAIL; API-mode/build guard tests 6 PASS / 0 FAIL. Demo and real frontend builds both passed; the real bundle contained no demo-only copy or mock fixture markers. git diff --check passed. Static deploy uses scripts/deploy-demo.mjs with a hard-coded independent site/account identity, clean artifact requirement and exact static-file allowlist; no paid upgrade, environment change or Function upload.
