// J-003 session-free checks. GET only: useful while D-05 is DRAFT and cleanup is not deployed.
// API portions of UI cases stay PENDING; this never claims a whole screen has been accepted.
import { existsSync, writeFileSync } from 'node:fs';
import { deploymentUrl, resolveReleaseTarget } from '../../scripts/lib/release-target.mjs';
import { deploymentEvidence, observeDeployment } from './deployment-evidence.mjs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const target = resolveReleaseTarget(args, process.env, { allowInsecure: local });
const out = args.find((a) => a.startsWith('--out='))?.slice(6);
if (target.problems.length || !out) {
  console.error('Usage: node tests/e2e/run-public-api-e2e.mjs --base-url=<https URL> --commit=<full SHA> --out=<file> [--local]');
  for (const p of target.problems) console.error(p);
  process.exit(2);
}
const startedAt = new Date().toISOString();
const results = [];
const diagnostics = [];
const record = (caseId, status, evidence) => {
  results.push({ caseId, status, evidence });
  console.log(`${status.padEnd(8)} ${caseId} ${evidence}`);
};
const before = await observeDeployment(target.env);
let after = null;
let failed = false;
async function get(path) {
  try {
    const res = await fetch(deploymentUrl(target.env, path), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    let json = null;
    try { json = JSON.parse(await res.text()); } catch { /* HTML is not an API envelope. */ }
    return { status: res.status, json };
  } catch { return { status: null, json: null }; }
}
if (before.commit !== target.commit) {
  failed = true;
  console.log('FAIL     deployed version differs from target; no case was run');
} else {
  const unknown = await get('/api/v1/e2e-unknown-endpoint');
  record('E2E-21', unknown.status === 404 && unknown.json?.success === false && unknown.json?.error?.code === 'NOT_FOUND' ? 'PASS' : 'FAIL', `unknown API: HTTP ${unknown.status}, code ${unknown.json?.error?.code ?? '(not JSON)'}`);

  const knowledge = await get('/api/v1/knowledge/status');
  // Status alone is not proof of the full first-publication procedure (E2E-25).
  diagnostics.push({ check: 'published knowledge status', status: knowledge.status, version: knowledge.json?.data?.version ?? null });

  for (const [caseId, path, fn] of [
    ['E2E-44', '/api/v1/providers', 'providers'],
    ['E2E-48', '/api/v1/knowledge/records', 'knowledgeRecords'],
  ]) {
    const r = await get(path);
    const missing = r.status === 404 && r.json?.error?.code === 'NOT_FOUND' && /尚未提供/.test(r.json?.error?.message ?? '');
    // Until B-013 is merged, Netlify's provider-detail splat catches the list URL and returns this error.
    const oldDetail = fn === 'providers' && !existsSync('apps/api/src/functions/providers.ts') && r.status === 400 && /providerId/.test(r.json?.error?.message ?? '');
    if (missing || oldDetail || r.status === null) {
      record(caseId, 'PENDING', `${path}: ${r.status ?? 'unreachable'}; list API unavailable, API/UI acceptance remains pending`);
      continue;
    }
    if (fn === 'knowledgeRecords' && r.status === 503 && r.json?.error?.code === 'KNOWLEDGE_UNAVAILABLE') {
      record(caseId, 'PENDING', `${path}: no published knowledge; successful list and UI states remain pending`);
      continue;
    }
    const data = r.json?.data;
    const envelope = r.status === 200 && r.json?.success === true && Array.isArray(data?.items);
    const version = fn !== 'knowledgeRecords' || /^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(data?.knowledgeVersion ?? '');
    record(caseId, envelope && version ? 'PENDING' : 'FAIL', envelope && version
      ? `${path}: API list returned ${data.items.length} items; filters, provenance, UI and no-session browser checks not yet accepted`
      : `${path}: invalid list response (HTTP ${r.status})`);
  }
  after = await observeDeployment(target.env);
}
const deployment = deploymentEvidence(before, after, target.commit);
writeFileSync(out, `${JSON.stringify({ schemaVersion: 2, runId: `public-${startedAt}`, apiMode: 'real', baseUrl: target.env.key,
  commit: target.commit, startedAt, finishedAt: new Date().toISOString(), operator: 'tests/e2e/run-public-api-e2e.mjs',
  deployment, results, diagnostics }, null, 2)}\n`);
if (!deployment.matches || results.some((r) => r.status === 'FAIL')) failed = true;
console.log(`${results.filter((r) => r.status === 'PASS').length} PASS, ${results.filter((r) => r.status === 'FAIL').length} FAIL, ${results.filter((r) => r.status === 'PENDING').length} PENDING; GET only; full MVP is not accepted`);
process.exitCode = failed ? 1 : 0;
