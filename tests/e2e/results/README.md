# E2E results

Result files (`*.json`, schemaVersion 2) are written by tools, not by hand:

- API write cases: `tests/e2e/run-api-e2e.mjs --allow-writes` (J-003-r16). A valid ACTIVE combination in the checked-out registry and a matching deployed SHA are required before any POST/DELETE. Without these, no write is attempted and the prerequisite stays PENDING. Synthetic records must be tracked and cleanup verified separately. E2E-02/04/17 remain PENDING while their additional contract scenarios have not been exercised.
- Staging entry point: `scripts/smoke-staging.mjs --base-url=<url> --commit=<full SHA> --out=<file>` defaults to public GET checks. `--write-e2e --allow-writes` explicitly delegates to the API runner; legacy `--with-assessment` has the same full write-E2E scope and is not an assessment-only flag.
- Session-free GET checks: `tests/e2e/run-public-api-e2e.mjs` (J-003-r10). E2E-44/48 remain PENDING even when their list API succeeds; a partial API probe is not full UI acceptance. Knowledge status is diagnostic, not E2E-25.
- Empty-Session foundation diagnostic (r30): `tests/e2e/run-foundation-e2e.mjs --base-url=https://kareo-tw.netlify.app --commit=<deployed SHA> --allow-empty-session-writes --out=<file>`. This separately scoped diagnostic for the user-designated acceptance site can check E2E-01/03/21 while D-05 stays DRAFT. It creates one empty disposable Session, submits only its ID to the consent-denial path, tests a forged token and requests Session deletion/token invalidation. It never submits consent, health/location/contact data, recommendations or Leads. The full write runner's ACTIVE precondition is unchanged. Partial E2E-17/37 stay PENDING; physical deletion is verified separately, never assumed from request acceptance. Its matching version is read before/after; tokens and Session IDs do not appear in the result.
- `ui`／`ops` cases: `tests/e2e/record-manual.mjs` (run right after the manual check)

All runners read the deployed version marker `<base-url>/kareo-version.json` and store what they observed.

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
