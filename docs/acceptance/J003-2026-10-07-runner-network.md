# J-003-r23 runner connectivity investigation

Compare Ubuntu, Windows and macOS standard GitHub-hosted runners using only public reads of the same three approved failed sources. No environment, database credential, registry change, proxy, TLS bypass, persistent runner or paid larger runner is used. Repository Kareo is public; [GitHub billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) says standard hosted runner execution in public repositories is free.

The matrix tests an alternate routing environment before changing the operational crawler. Node and curl statuses are recorded separately. A green diagnostic job means only that the investigation finished; crawlerAcceptance is always false. No source is disabled or approved, no knowledge is published, and no E2E PASS is created.

Actual execution is pending. After results, select a runner only if the actual 18-source official crawler works there and preserves snapshot/last-publication boundaries. Failure on all runners remains issue #88 and needs an approved reachable execution environment or reviewed official canonical source.

Validation: script syntax and diff check. Existing full CI validates exact submitted head.
