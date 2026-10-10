# J-004-r18: reviewed public-resource release, 2026-10-10

User authorized publishing completed work to Netlify. PR [#123](https://github.com/viz963-1216/Kareo/pull/123) promoted staging `ab8625547de5f13845d8c8897508cf7012f9578e` to release. Exact promotion head: CI 8/8 SUCCESS ([38028658955](https://github.com/viz963-1216/Kareo/actions/runs/38028658955)), isolated local HTTP integration SUCCESS ([38028658935](https://github.com/viz963-1216/Kareo/actions/runs/38028658935)). Before deployment, strict MVP gate had 115 PASS / 1 FAIL / 49 PENDING; the FAIL was the old live SHA. This was approved within the existing public-resources scope, not full MVP acceptance.

## Actual published deployment

- Release merge commit: `cf32202453f2c21610f538724b39d30d63a70486`.
- Netlify deploy: `6ac9d1ae2a09190008cf31c5`, Published observed in Chrome.
- [Public site](https://kareo-tw.netlify.app/), [resources](https://kareo-tw.netlify.app/resources), [knowledge](https://kareo-tw.netlify.app/info).
- `/kareo-version.json`: exact merge SHA, branch release, context production, build time `2026-10-10T05:49:34.929Z`. The build timestamp is not an inferred publish timestamp.
- One automatic release deployment. Production scope remains public-resources / real API / required session token. No changes to formal consent versions, DB credentials, branch deployment settings or paid Supabase projects.

## Post-deploy observations at this SHA

- [GET smoke](evidence/J004-2026-10-10-release-smoke.json): 5/5 PASS (HTML shells and knowledge status), exact marker before/after.
- [Public API matrix](evidence/J004-2026-10-10-public-query-matrix.json): 27/27 PASS, exact marker before/after. Covers real resources, service and official assistive categories, contract cities, unknown-area behavior, empty/pagination/errors, published knowledge. The default resource total is 1117.
- [Public deployment receipt](../../tests/e2e/results/public-release-2026-10-10.json): E2E-21 PASS; full E2E-44/48 remain PENDING. HTML/API smoke is not a complete browser-flow acceptance.
- Chrome loaded the real resource list with 1117 matching resources. No Session, consent, health or contact writes were performed for these public checks.
- [Strict release gate output](J004-2026-10-10-release-gate.txt): 116 PASS / 0 FAIL / 48 PENDING, RELEASE GATE FAILED. Older reports targeting `56500c8` are ignored; do not carry their 7/49 results to this deployment.

D-05 remains DRAFT / unactivated, and Integrated remains false. The next UI checkbox correction is recorded separately; this report is historical evidence for the deployment above.
