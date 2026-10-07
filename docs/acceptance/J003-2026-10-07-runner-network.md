# J-003-r23 runner connectivity investigation

Compare Ubuntu, Windows and macOS standard GitHub-hosted runners using only public reads of the same three approved failed sources. No environment, database credential, registry change, proxy, TLS bypass, persistent runner or paid larger runner is used. Repository Kareo is public; [GitHub billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) says standard hosted runner execution in public repositories is free.

The matrix tests an alternate routing environment before changing the operational crawler. Node and curl statuses are recorded separately. A green diagnostic job means only that the investigation finished; crawlerAcceptance is always false. No source is disabled or approved, no knowledge is published, and no E2E PASS is created.

Actual matrix [run 37570374052](https://github.com/viz963-1216/Kareo/actions/runs/37570374052) used head `88197c40cc5b275e0207dc07d101111f68c24f09`. All three diagnostic jobs finished, but no runner reached both careyou sources:

| Standard runner | Law Node HTTP | Law curl | care-branch Node/curl | ltcts Node/curl |
|---|---|---|---|---|
| Ubuntu | no HTTP; IPv4 ETIMEDOUT / IPv6 ENETUNREACH | 200, TLS verified | connect timeout / curl 28 | connect timeout / curl 28 |
| Windows | 200 | HTTP 200 and verified TLS, then curl 23 from POSIX null path | connect timeout / curl 28 | connect timeout / curl 28 |
| macOS | 200 | 200, TLS verified | connect timeout / curl 28 | connect timeout / curl 28 |

Windows curl's output-path error does not invalidate its separate Node HTTP 200 observation. Use `node:os` devNull for subsequent cross-platform diagnostics. The two careyou failures occur before any HTTP response; this does not prove a geo-blocking policy. No operational crawler runner is changed from this matrix.

A focused Ubuntu law-only follow-up compares IPv4-first with family auto-selection disabled, using [documented Node 22 flags](https://nodejs.org/download/release/v22.23.0/docs/api/cli.html). It retains normal TLS verification, approved canonical URL and 20-second timeout; no proxy/credential/DB write. Its result is pending until executed. After results, select a runner only if the actual 18-source official crawler works there and preserves snapshot/last-publication boundaries. Failure on all runners remains issue #88 and needs an approved reachable execution environment or reviewed official canonical source.

Validation: script syntax and diff check. Existing full CI validates exact submitted head.
