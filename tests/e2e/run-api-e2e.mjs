// J-003 real-API E2E runner (no dependencies). Runs the API-only cases of tests/e2e/acceptance-cases.json
// against a deployed environment and writes a result file for scripts/acceptance-gate.mjs.
//
//   node tests/e2e/run-api-e2e.mjs https://<staging-host> --commit <sha> [--out tests/e2e/results/<run>.json]
//
// Rules: a case is PASS only when the real API behaves as the contract requires. Anything the environment
// cannot yet exercise (missing endpoint, no ACTIVE consent version, no PUBLISHED knowledge) is PENDING with a
// reason — never PASS. Cases that also need a browser (ui) or an operator (ops) are not decided here.
// Uses synthetic data only. It does not call any paid service.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const base = new URL(args[0] ?? 'invalid:');
if (!['https:', 'http:'].includes(base.protocol)) {
  console.error('Usage: node tests/e2e/run-api-e2e.mjs <base-url> --commit <sha> [--out file]');
  process.exit(2);
}
const commit = opt('--commit') ?? '';
const out = opt('--out');

const results = [];
const record = (caseId, status, evidence) => { results.push({ caseId, status, evidence }); console.log(`${status.padEnd(8)} ${caseId} ${evidence}`); };

async function call(method, path, { body, token, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h['X-Kareo-Session-Token'] = token;
  const response = await fetch(new URL(path, base), { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}
const code = (r) => r.json?.error?.code;
const routeMissing = (r) => r.status === 404 && code(r) === 'NOT_FOUND' && /尚未提供/.test(r.json?.error?.message ?? '');

const activeConsent = JSON.parse(readFileSync('contracts/legal/consent-versions.json', 'utf8')).versions.find((v) => v.status === 'ACTIVE');
const assessmentBody = (sessionId, location = { city: '新北市', district: '三重區', precision: 'DISTRICT', lat: null, lng: null }) => ({
  sessionId, ageRange: '75_84', location, livingSituation: 'WITH_FAMILY', caregiverSituation: 'FAMILY_LIMITED',
  mobilityLevel: 'NEEDS_ASSISTANCE', dailyLivingLevel: 'PARTIAL_ASSISTANCE',
  needs: { homeCare: 'YES', medicalNursing: 'UNKNOWN', assistiveDevice: 'YES', transportation: 'YES' },
  freeText: 'e2e synthetic record',
});

async function newSession() {
  const r = await call('POST', '/api/v1/session');
  return { r, id: r.json?.data?.sessionId, token: r.json?.data?.sessionToken };
}

// E2E-21 unknown API → JSON 404
{
  const r = await call('GET', '/api/v1/e2e-unknown-endpoint');
  record('E2E-21', r.status === 404 && code(r) === 'NOT_FOUND' ? 'PASS' : 'FAIL', `status ${r.status} code ${code(r) ?? '(not JSON)'}`);
}

// E2E-01 session token
const a = await newSession();
if (!(a.r.status === 200 && a.id)) record('E2E-01', 'FAIL', `session creation returned ${a.r.status}`);
else if (typeof a.token !== 'string' || a.token.length < 32) record('E2E-01', 'PENDING', 'session created but no sessionToken (B-011a not deployed)');
else record('E2E-01', 'PASS', `sessionToken issued (${a.token.length} chars)`);

// E2E-17 forged token
if (a.token) {
  const r = await call('POST', '/api/v1/consent', { token: 'forged-token-for-e2e', body: { sessionId: a.id, ...(activeConsent ?? {}), accepted: true } });
  record('E2E-17', r.status === 401 && code(r) === 'SESSION_INVALID' ? 'PASS' : 'FAIL', `forged token → ${r.status} ${code(r)}`);
} else record('E2E-17', 'PENDING', 'no session tokens issued yet (B-011a)');

// E2E-03 assessment without consent
{
  const s = await newSession();
  const r = await call('POST', '/api/v1/assessments', { token: s.token, body: assessmentBody(s.id) });
  if (code(r) === 'CONSENT_REQUIRED' && r.status === 403) record('E2E-03', 'PASS', '403 CONSENT_REQUIRED');
  else record('E2E-03', 'FAIL', `expected 403 CONSENT_REQUIRED, got ${r.status} ${code(r)}`);
}

// E2E-02 consent with ACTIVE versions; rejection paths
let consented = false;
if (!activeConsent) {
  record('E2E-02', 'PENDING', 'no ACTIVE consent version in contracts/legal/consent-versions.json (D-05)');
} else {
  const versions = { disclaimerVersion: activeConsent.disclaimerVersion, privacyVersion: activeConsent.privacyVersion, termsVersion: activeConsent.termsVersion };
  const refused = await call('POST', '/api/v1/consent', { token: a.token, body: { sessionId: a.id, ...versions, accepted: false } });
  const unknown = await call('POST', '/api/v1/consent', { token: a.token, body: { sessionId: a.id, disclaimerVersion: 'e2e-unknown', privacyVersion: 'e2e-unknown', termsVersion: 'e2e-unknown', accepted: true } });
  const ok = await call('POST', '/api/v1/consent', { token: a.token, body: { sessionId: a.id, ...versions, accepted: true } });
  consented = ok.status === 200 && ok.json?.success === true;
  const pass = consented && code(refused) === 'VALIDATION_ERROR' && code(unknown) === 'VALIDATION_ERROR';
  record('E2E-02', pass ? 'PASS' : 'FAIL', `accepted=false→${code(refused)}, unknown version→${code(unknown)}, ACTIVE→${ok.status}`);
}

// E2E-04 real assessment
if (!consented) {
  record('E2E-04', 'PENDING', 'no consented session (E2E-02 not passing)');
} else {
  const first = await call('POST', '/api/v1/assessments', { token: a.token, body: assessmentBody(a.id) });
  if (code(first) === 'KNOWLEDGE_UNAVAILABLE') record('E2E-04', 'PENDING', 'KNOWLEDGE_UNAVAILABLE: no PUBLISHED knowledge (D-02, B-008, E2E-25)');
  else if (first.status !== 200) record('E2E-04', 'FAIL', `assessment ${first.status} ${code(first)}`);
  else {
    const second = await call('POST', '/api/v1/assessments', { token: a.token, body: assessmentBody(a.id) });
    const d1 = first.json.data;
    const d2 = second.json?.data;
    const problems = [];
    if (!/^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(d1.knowledgeVersion ?? '')) problems.push(`knowledgeVersion ${d1.knowledgeVersion}`);
    if (!(d1.careNeedProfile?.warnings?.length > 0)) problems.push('no warnings');
    if (JSON.stringify(d1.careNeedProfile?.careNeeds) !== JSON.stringify(d2?.careNeedProfile?.careNeeds)) problems.push('not deterministic');
    record('E2E-04', problems.length ? 'FAIL' : 'PASS', problems.join('; ') || `${d1.assessmentId} ${d1.knowledgeVersion}`);
  }
}

// Endpoints that later cases need: report PENDING with the reason, never PASS.
for (const [caseIds, method, path] of [
  [['E2E-07', 'E2E-08', 'E2E-09', 'E2E-11'], 'POST', '/api/v1/recommendations'],
  [['E2E-13', 'E2E-14'], 'POST', '/api/v1/leads'],
]) {
  const r = await call(method, path, { token: a.token, body: {} });
  const reason = routeMissing(r) ? `${path} not deployed` : `${path} deployed; automated case not written yet (needs A-005 data cases)`;
  for (const id of caseIds) record(id, 'PENDING', reason);
}
for (const id of ['E2E-18', 'E2E-19', 'E2E-20']) record(id, 'PENDING', 'needs B-011a／B-011b deployed; automated case not written yet');

// E2E-16 API part only; the browser (new tab, no iframe) and target-site checks are manual.
{
  const r = await call('GET', '/api/v1/external-services/transportation');
  const apiOk = r.json?.data?.url === 'https://kareocar.netlify.app/' && r.json?.data?.openMode === 'NEW_TAB';
  record('E2E-16', apiOk ? 'PENDING' : 'FAIL', apiOk ? 'API part OK; new-tab UI and Kareocar availability still need a manual result' : `transportation API ${r.status}`);
}

const run = { runId: `api-${new Date().toISOString().slice(0, 19)}`, apiMode: 'real', baseUrl: base.origin, commit, date: new Date().toISOString().slice(0, 10), operator: 'tests/e2e/run-api-e2e.mjs', results };
if (out) writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('PENDING')} PENDING${out ? ` → ${out}` : ''}`);
if (!commit) console.log('No --commit given: the result file will not be counted by the acceptance gate.');
process.exit(count('FAIL') ? 1 : 0);
