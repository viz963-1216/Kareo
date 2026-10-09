# J-003-r32 — Public adapter error handling and local HTTP verification

Submission Version: J-003-r32. Base staging: `224f4311bc359b6be31c824638cc4802726678cb` (merged #119).

## Reproduced defect and correction

The public real API adapter forwarded `error.message` when a code had no local fallback. Consequently, both Provider lookup and knowledge lookup exposed deliberately injected internal diagnostics for `INTERNAL_ERROR` and an unexpected upstream code. Before correction the new loopback HTTP tests produced **10 PASS / 4 FAIL**, exit 1. The diagnostic strings are synthetic test markers, not actual credentials or evidence of an observed production leak.

`apps/web/src/api/realAdapter.ts` now uses reviewed local Chinese messages for contract error codes and a generic message for unexpected codes. Code and HTTP status remain available to callers. Own-property lookup prevents prototype names such as `constructor`, `__proto__` and `toString` from being interpreted as messages. This implements ARCHITECTURE §20.6; it does not change API contracts or business rules. The separate admin adapter is unchanged.

## Local HTTP transport evidence

`tests/web/publicHttpSafety.test.ts` runs the actual adapter and native fetch against an ephemeral **127.0.0.1** HTTP server. The wrapper only resolves relative URLs; it does not return stub fetch responses. Success bodies are existing contract fixtures, and failures are deliberately injected into this local server. **This is not a deployed API or browser test.**

Both lookup endpoints exercise seven conditions: validated success; internal-error and unknown-error rejection followed by successful retry; malformed data on HTTP 200; platform HTML error followed by retry; socket reset followed by retry; and an incomplete response body that reaches the configured timeout followed by retry. Every observed request is a GET to the expected public endpoint. A synthetic stored token is never sent, and the adapter does not create or change local credentials. Retried paths, including filters, match the original request. There is no hidden retry on the first failure.

Results after correction:

- New native HTTP tests: **14 PASS / 0 FAIL**.
- Root scripts/adapter tests, including the new tests and prototype-code counterexamples: **132 PASS / 0 FAIL**.
- Frontend module tests: **87 PASS / 0 FAIL**; real-mode typecheck/build passed.
- Final targeted adapter/HTTP rerun: **31 PASS / 0 FAIL**.
- Development gate: **115 PASS / 0 FAIL / 49 PENDING**; no release target supplied, so all 12 existing deployment receipt files were intentionally ignored. This is not the previous exact-target release gate's 122/42 result.

Commands: `node --experimental-strip-types --test 'tests/**/*.test.*'`; `npm test --prefix apps/web`; `npm run build --prefix apps/web`; `node --experimental-strip-types --test tests/web/publicHttpSafety.test.ts tests/web/realAdapter.test.ts`; `npm run typecheck --prefix apps/web`; `node scripts/acceptance-gate.mjs --mode=dev`.

## Deployment and remaining acceptance

The public version marker remains release `56500c835df2869ad7e4540f6f0730cb31ccbbcd`, deploy `6ac7631c4b91470008fb7960`. **The r32 adapter correction has not been deployed.** Staging PR CI does not trigger a Netlify deployment; deployment can be batched with the next reviewed release update.

Chrome was opened on this actual deployment. A usable DevTools Network capture was not obtained through the available UI controls, and no complete browser failure/retry sequence was executed. No absence of Session requests is inferred from DOM inspection or these local tests. E2E-42/44/45/47/48 therefore remain PENDING; the retained deployed acceptance is **7/49 PASS, 0 FAIL, 42 PENDING**, as recorded in [r31](J003-2026-10-09-token-and-public-query.md).

D-05 remains DRAFT / OWNER_APPROVED_CONDITIONAL with activationAllowed=false. Jerry's decision to defer the paid independent physical restore project remains in effect. Full J-003 is not Integrated. No cloud database write, consent activation, new Session, health/contact/Lead submission, cloud crawler retry, paid project or Netlify deployment was performed in this revision.
