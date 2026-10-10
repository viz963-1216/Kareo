# C-005 reading-confirmation correction, 2026-10-10

User reported that the service/disclaimer/privacy checkbox could not be selected on the newly published Netlify site. Reproduced on `cf32202453f2c21610f538724b39d30d63a70486`: real mode has no active consent archive; documentReady remains false, and the UI incorrectly disables the reading control together with the formal submission control.

## Correction and scope

The real deployment with no formal consent archive now offers an unchecked, enabled **reading acknowledgement**, explicitly stating that formal consent has not been submitted. A description next to the control explains that this state stays in the current page and creates no Session or consent record. The disabled action is labeled “正式評估尚未開放”, with links to public resources and knowledge.

Formal submission still requires a verified archive and documentReady, explicit acceptance and no in-flight request. The submit handler additionally refuses a missing formal archive. Loading/failed verification of an actual formal archive continues to disable its formal-consent checkbox. Mock and the independent public-data mode keep their existing behavior. No consent registry, API contract, database or deployment security setting is changed.

## Actual validation before PR

- Frontend tests: 88 PASS / 0 FAIL, including the compiled actual ConsentPage rendered for real/no-archive and mock modes. Existing compiled API tests still reject unknown or changed documents before a Session call.
- Real-mode TypeScript/Vite build: PASS.
- Chrome at local production build `http://127.0.0.1:4187/consent`: enabled unchecked reading control; mouse changes it to checked; Space changes it to unchecked. Formal assessment action remains disabled, with its reason visible.

These are local UI/technical checks, not E2E-02/37/41 formal deployed consent acceptance. Deployment of the correction and exact SHA will be recorded in the release PR conversation. D-05 remains unactivated and Integrated is false.
