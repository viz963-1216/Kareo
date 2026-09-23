# E2E results

Result files (`*.json`) are written by `tests/e2e/run-api-e2e.mjs` or recorded by hand for `ui`／`ops` cases:

```json
{
  "runId": "2026-10-14-01",
  "apiMode": "real",
  "baseUrl": "https://kareo-tw.netlify.app",
  "commit": "<staging commit>",
  "date": "2026-10-14",
  "operator": "<real person>",
  "results": [{ "caseId": "E2E-16", "status": "PASS", "evidence": "..." }]
}
```

`scripts/acceptance-gate.mjs` counts a case as PASS only when `apiMode` is `real`, `baseUrl` is https and not localhost, and `commit`／`date` are present. Mock or local runs are ignored. Do not put real personal data here.
