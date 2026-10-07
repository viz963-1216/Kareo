# J-004-r11 — Separate shareable presentation

Owner decision, 2026-10-07 (Asia/Taipei): Jerry asked 「繼續執行未完成事項，另外隱私權警告問題先讓他通過，過幾天我要demo了」 and selected 「需要可分享的展示網址」 after being offered a complete fictional-case presentation environment. **DEMO_APPROVED** applies to that synthetic presentation, not formal consent activation or legal certification. The extra human customer-support rehearsal remains CANCELLED_BY_OWNER (#102).

## Scope and implementation

Central task: build and publish an independent static presentation from the existing Kareo frontend. Paths: apps/web demo-only presentation changes, scripts/build-demo.mjs, existing build-guard tests, docs/tasks. No schema, live Supabase data, real consent registry, immutable candidate/review JSON or cloud credentials change. Jerry's standing instruction to complete ABCJ authorizes these central cross-module presentation changes.

`node scripts/build-demo.mjs` builds a local static `demo-dist` artifact with existing mock fixtures (use `--github-pages` for the `/Kareo/` asset base). Standard site/Netlify builds reject the demo flag; real production and acceptance still use real APIs. The demo build takes only ordinary process settings, never provider credentials, and contains no Functions deployment. Publish only the static artifact through the separate demo-pages branch/GitHub Pages or isolated presentation site, never kareo-tw or Kareocar. This is an explicit owner-authorized presentation exception to the usual non-deployed mock rule, not a new release configuration.

The visible banner and consent/privacy pages identify fictional examples and browser-memory behavior. Fixed test contact fields are read-only, free text and real GPS are disabled, admin login is unavailable, and the matching success page explicitly says no actual case or contact was created. No unchecked consent is silently accepted. API paths return 404; A meta CSP disables ordinary form submissions; demo navigation uses hash routes for static-host reloads. Real GPS is disabled in the UI. Netlify-specific headers additionally disable geolocation and indexing when supported by that host. Normal static-host network logs remain possible and are disclosed. External Maps/official-source/Kareocar links remain external and carry no assessment payload.

## Acceptance distinction

Presentation/privacy-warning readiness is approved for the synthetic demo. Formal D-05 registry stays DRAFT with activationAllowed=false and approvalConditionsSatisfied=false; no missing evidence is relabelled PASS. Published demo/browser evidence goes here, never tests/e2e/results. The 49 deployed API/DB acceptance cases, physical backup restore/copy retirement, daily schedule evidence and formal release remain separate work.

## Rebuild and walkthrough

1. Use the approved feature/staging commit, npm ci --prefix apps/web, then node scripts/build-demo.mjs --github-pages locally.
2. Inspect demo-dist/kareo-demo-version.json and verify sourceCommit plus workingTreeDirty=false before publishing. No environment file, Function bundle or key goes into the upload.
3. Present a fictional person: age 65+, New Taipei city / Sanchong district, income category GENERAL, needs home care and assistive devices. Follow consent → assessment → results → recommendation → detail/Maps → mock matching with fixed test contact. Show the needs summary and public resource/knowledge pages.
4. Refresh to reset the browser-memory example. It is not a saved real case. Never use the demo output as a benefits decision or a real referral.

Initial public deployment succeeded: https://viz963-1216.github.io/Kareo/, artifact branch demo-pages d89b5ab6f37eb2bd54f3ab492e667405413983a9, source f0e72e5e86f004c1e795f2ef887f27c3ea4e5db8. Homepage/version HTTP 200 and demo API HTTP 404 verified. Initial walkthrough found generic real-service reset text inherited by the demo; r11 replaces it with demo-only reset copy and defaults to the existing 3-provider fixtures. Final deployed walkthrough is recorded after rebuilding this revision.

Pre-deployment checks: frontend tests 81 PASS / 0 FAIL; API-mode/build guard tests 6 PASS / 0 FAIL. Demo and real frontend builds both passed; the real bundle contained no demo-only copy or mock fixture markers. git diff --check passed. Static deploy uses scripts/deploy-demo.mjs with a hard-coded independent site/account identity, clean artifact requirement and exact static-file allowlist; no paid upgrade, environment change or Function upload.

Netlify attempted static upload returned HTTP 403: Account credit usage exceeded - new deploys are blocked until credits are added. No paid upgrade was performed. The independently created kareo-demo-tw site has not been published. To deliver the requested shareable URL, use GitHub Pages on the dedicated demo-pages artifact branch; source development still uses feature PR → staging, not direct staging/main push. GitHub Pages ignores Netlify _headers/_redirects; do not claim those response headers were enforced there.


## Final published demonstration verification

Public URL: **https://viz963-1216.github.io/Kareo/**. Published source is `5a4bc57d5e987cbbdc970dbcd52eed9674b8f921`, static artifact `a1df6058a88c68a4322c86e708d47e0e6dbc08b9`, Pages workflow [37646307670](https://github.com/viz963-1216/Kareo/actions/runs/37646307670). Actual public manifest was read after publication and matched that source with workingTreeDirty=false, realApi=false, realCases=false and formalConsentActivated=false. Browser loaded `/Kareo/assets/index-sAQjh-q8.js`. This report is a later documentation-only commit; its SHA is not substituted for the deployed application's SHA.

Actual public browser operations (synthetic presentation evidence only):

| Operation | Observed outcome |
| --- | --- |
| Consent screen | Unchecked presentation acknowledgement blocks start; checking it starts the mock assessment without a real Session error. |
| Fictional assessment | New Taipei / Sanchong, default age 75–84, GENERAL income category, home care and assistive-device needs submit and display results. Real GPS is absent and free text is read-only. |
| Result / summary | Institutional information, example knowledge version and 1966 reminder appear; clicking generate produces the structured needs summary with print/copy controls. Print dialog and clipboard writes were not exercised. |
| Recommendation | Final source displays three existing fictional home-care providers. An earlier default-count override still supplied 1; this was detected in browser and corrected before the final artifact. No actual distance/data-source matching acceptance is claimed. |
| Provider detail | Existing fictional detail renders, Maps href equals `https://www.google.com/maps/search/?api=1&query=PROV-MOCK-001`. No phone call, external contact or booking submitted. |
| Mock matching | Contact fields are read-only; explicit mock acknowledgement plus submit shows “媒合流程展示完成”, “沒有送出真實案件” and illustrative LEAD-MOCK-001. No cloud write. |
| Reset | Return to result → restart shows “展示資料已重設”, without promising a real database deletion. Refreshing a hash result route resets in-memory state and shows the no-result screen. |
| Public resources | Without an assessment, filter assistive resource centers → search displays the existing fictional center; its detail contains no matching link. This does not validate live source completeness. |
| Public knowledge / privacy | Knowledge information and versions render; demo privacy explicitly describes fictional data, browser memory, host logs, external services and the approved public contact. |
| Mobile home | 375px viewport: document width=375 and scrollWidth=375, no horizontal overflow observed. Other mobile routes/full keyboard flow have not been accepted by this check. Temporary viewport override was reset. |
| Static backend boundary | Actual GET `/Kareo/api/v1/leads` returns 404. Demo artifact contains no Functions or credentials. |

Screenshots are kept locally in `work/j004-oct07-demo/` outside the repository (home, mobile and Top 3); only synthetic UI is shown. Final application source: frontend 81/81; mode/build guard 6/6; clean demo TypeScript/Vite build PASS. CI [37646240262](https://github.com/viz963-1216/Kareo/actions/runs/37646240262) and local HTTP [37646240034](https://github.com/viz963-1216/Kareo/actions/runs/37646240034) both completed successfully. The local HTTP artifact is preserved unchanged at [evidence/J004-2026-10-07-demo-local-http.json](evidence/J004-2026-10-07-demo-local-http.json): LOCAL-INTEGRATION-ONLY, 50 PASS, cloudWrites=0, releaseAcceptance=false. GitHub artifact 11494332993 ZIP SHA-256 `312e3978241bd69b272bfc4827c6b1297055f001711feed393b24967386103dd` matched the downloaded ZIP. The real-mode CI build and mock-fixture scan also passed. No outcome is added to the 49 deployed real E2E results.

## 給 Jerry 的展示順序

1. 分享 https://viz963-1216.github.io/Kareo/，首頁可直接查詢資源、制度資訊與交通外部平台。
2. 選「開始免費長照評估」，勾選使用虛構個案；所在地選「新北市／三重區」，家庭經濟身分選「以上皆非」，其餘可保留示範預設值。
3. 結果頁展示服務需求、制度與补助說明，再產生給個管師／1966 的需求摘要。
4. 點居家照顧的「查看服務單位」，展示 Top 3、推薦原因與詳細資料；媒合表單採固定測試聯絡資料，勾選示範聲明後即可展示成功畫面。
5. 返回初步結果 → 重新開始；每位觀眾在自己的分頁操作，重新整理會重設。展示資料不是最新正式資料庫匯入結果，媒合不會送出真實案件。

正式工作仍保留：D-05 工程啟用條件、49 項同版本真實部署 E2E、實際備份還原／退役證據、每日 crawler/cleanup 排程首輪證據與兩個新北官方來源 timeout（#88）。這次展示版完成不會把這些狀態改成 PASS。
