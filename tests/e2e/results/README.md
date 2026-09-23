# E2E results

Result files (`*.json`, schemaVersion 2) are written by tools, not by hand:

- API cases: `tests/e2e/run-api-e2e.mjs`
- `ui`／`ops` cases: `tests/e2e/record-manual.mjs` (run right after the manual check)

Both read the deployed version marker `<base-url>/kareo-version.json` and store what they observed.

```json
{
  "schemaVersion": 2,
  "runId": "api-2026-10-14T02:03:04.567Z",
  "apiMode": "real",
  "baseUrl": "https://kareo-tw.netlify.app",
  "commit": "<full 40-hex target SHA>",
  "startedAt": "2026-10-14T02:03:04.567Z",
  "finishedAt": "2026-10-14T02:03:09.012Z",
  "operator": "tests/e2e/run-api-e2e.mjs | <real person>",
  "deployment": {
    "method": "kareo-version.json",
    "targetCommit": "<same SHA>",
    "before": { "versionUrl": "https://kareo-tw.netlify.app/kareo-version.json", "fetchedAt": "…", "commit": "<observed SHA>", "context": "production", "deployId": "…" },
    "after":  { "versionUrl": "…", "fetchedAt": "…", "commit": "<observed SHA>" },
    "matches": true
  },
  "results": [{ "caseId": "E2E-16", "status": "PASS", "evidence": "...", "recordedAt": "(optional ISO timestamp)" }]
}
```

## How `scripts/acceptance-gate.mjs` uses these files

The gate is given one target: `--commit=<sha> --base-url=<url>` (or `KAREO_RELEASE_COMMIT`／`KAREO_RELEASE_BASE_URL`).

| File | Result |
|---|---|
| Corrupt JSON, missing field, not schemaVersion 2, time not a full ISO timestamp with time zone, status not `PASS`／`FAIL`／`PENDING`, unknown or duplicate `caseId` | **FAIL** (reported by file name) |
| `apiMode` not `real`; `baseUrl` not https or local | IGNORED, with reason |
| Different environment (URLs compared after WHATWG URL parsing; host case, default port and trailing `/` do not matter; **path does**, so `/app` ≠ `/app2` ≠ `/`) | IGNORED, with reason |
| Different commit | IGNORED, with reason |
| Target commit and environment, but deployment evidence missing, unknown, read from another URL, or `before`／`after` observed commit ≠ target | **FAIL** |
| Target commit and environment, evidence matches | counted |

Counted files only ever come from one commit and one environment, so results from different versions are never combined.
Per case, the result with the latest time wins, whatever its status (`recordedAt`, else the file's `finishedAt`):
a later `FAIL` or `PENDING` replaces an earlier `PASS`. If the two latest results have the same time and different
statuses, the case FAILs because the order cannot be decided. A case with no counted result is `PENDING`.

The `matches` field is informational; the gate recomputes it from `before`／`after`. Do not edit result files:
changing `commit` in an old file makes it disagree with its recorded observations and it FAILs. A file is not
signed, so someone who also rewrites the observations cannot be detected from the file alone. That is why result
files go through PR review and the release workflow makes its own API run in CI (uploaded as an artifact).

Do not put real personal data here.
