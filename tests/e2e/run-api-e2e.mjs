// J-003 real-API E2E runner (no dependencies). Runs the API-only cases of tests/e2e/acceptance-cases.json
// against a deployed environment and writes a result file for scripts/acceptance-gate.mjs.
//
//   node tests/e2e/run-api-e2e.mjs --base-url=https://<host>[/<path>] --commit=<40-hex sha> [--out=tests/e2e/results/<run>.json]
//   (or KAREO_RELEASE_BASE_URL / KAREO_RELEASE_COMMIT; add --local to try a local http server, which the gate never counts)
//
// --commit is the version you intend to verify, not proof. Before and after the cases the runner reads
// <base-url>/kareo-version.json (Netlify COMMIT_REF, written by scripts/build-site.mjs) and records what it
// observed. If the deployed commit differs from --commit or cannot be read, no case is run and the file
// records the mismatch, so the release gate cannot count it.
//
// Rules: a case is PASS only when the real API behaves as the contract requires. Anything the environment
// cannot yet exercise (missing endpoint, no ACTIVE consent version, no PUBLISHED knowledge) is PENDING with a
// reason — never PASS. Cases that also need a browser (ui) or an operator (ops) are not decided here
// (record them with tests/e2e/record-manual.mjs). Uses synthetic data only. It does not call any paid service.
import { readFileSync, writeFileSync } from 'node:fs';
import { deploymentUrl, resolveReleaseTarget } from '../../scripts/lib/release-target.mjs';
import { deploymentEvidence, observeDeployment } from './deployment-evidence.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const eq = args.find((a) => a.startsWith(`--${name}=`)); if (eq) return eq.slice(name.length + 3); const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const local = args.includes('--local');
const target = resolveReleaseTarget(args, process.env, { allowInsecure: local });
if (target.problems.length) {
  console.error(`Usage: node tests/e2e/run-api-e2e.mjs --base-url=<https url> --commit=<40-hex sha> [--out=file] [--local]\n- ${target.problems.join('\n- ')}`);
  process.exit(2);
}
const { commit, env } = target;
const out = opt('out');
const startedAt = new Date().toISOString();

function writeRun(results, evidence) {
  const run = {
    schemaVersion: 2,
    runId: `api-${startedAt}`,
    apiMode: 'real',
    baseUrl: env.key,
    commit,
    startedAt,
    finishedAt: new Date().toISOString(),
    operator: 'tests/e2e/run-api-e2e.mjs',
    deployment: evidence,
    results,
  };
  if (out) writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
}

const before = await observeDeployment(env);
console.log(`Target   ${commit} @ ${env.key}`);
console.log(`Deployed ${before.commit ?? '(unknown)'} via ${before.versionUrl}${before.error ? ` — ${before.error}` : ''}`);
if (before.commit !== commit) {
  writeRun([], deploymentEvidence(before, null, commit));
  console.log(`\nFAIL     deployed version does not match the target; no case was run${out ? ` → ${out}` : ''}`);
  process.exit(1);
}

const results = [];
const record = (caseId, status, evidence) => { results.push({ caseId, status, evidence }); console.log(`${status.padEnd(8)} ${caseId} ${evidence}`); };

async function call(method, path, { body, token, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h['X-Kareo-Session-Token'] = token;
  const response = await fetch(deploymentUrl(env, path), { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
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

const after = await observeDeployment(env);
const evidence = deploymentEvidence(before, after, commit);
writeRun(results, evidence);
const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('PENDING')} PENDING${out ? ` → ${out}` : ''}`);
if (!evidence.matches) {
  console.log(`FAIL     deployment evidence does not match the target (before ${before.commit ?? 'unknown'}, after ${after.commit ?? 'unknown'}); the gate will not count this run.`);
  process.exit(1);
}
process.exit(count('FAIL') ? 1 : 0);
