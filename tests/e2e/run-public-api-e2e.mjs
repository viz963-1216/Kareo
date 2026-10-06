// J-003 GET-only checks. List success is partial evidence, never full UI acceptance.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { deploymentUrl, resolveReleaseTarget } from '../../scripts/lib/release-target.mjs';
import { deploymentEvidence, observeDeployment } from './deployment-evidence.mjs';

export async function runPublicApiE2e({ target, fetchImpl = fetch, log = console.log }) {
  const startedAt = new Date().toISOString();
  const results = [];
  const diagnostics = [];
  const record = (caseId, status, evidence) => {
    results.push({ caseId, status, evidence });
    log(`${status.padEnd(8)} ${caseId} ${evidence}`);
  };
  const before = await observeDeployment(target.env, fetchImpl);
  let after = null;
  async function get(path) {
    try {
      const response = await fetchImpl(deploymentUrl(target.env, path), {
        method: 'GET', headers: { Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(15_000),
      });
      let json = null;
      try { json = JSON.parse(await response.text()); } catch { /* Not an API envelope. */ }
      return { status: response.status, json };
    } catch { return { status: null, json: null }; }
  }
  if (before.commit !== target.commit) {
    log('BLOCKED  deployed version differs from target or access is unavailable; no case was run');
  } else {
    const unknown = await get('/api/v1/e2e-unknown-endpoint');
    record('E2E-21', unknown.status === 404 && unknown.json?.success === false
      && unknown.json?.error?.code === 'NOT_FOUND' ? 'PASS' : 'FAIL',
    `unknown API: HTTP ${unknown.status}; JSON NOT_FOUND ${unknown.json?.error?.code === 'NOT_FOUND' ? 'present' : 'absent'}`);

    const knowledge = await get('/api/v1/knowledge/status');
    const version = knowledge.json?.data?.version;
    diagnostics.push({ check: 'published knowledge status', status: knowledge.status,
      version: /^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(version ?? '') ? version : null });

    for (const [caseId, path, needsVersion] of [
      ['E2E-44', '/api/v1/providers', false],
      ['E2E-48', '/api/v1/knowledge/records', true],
    ]) {
      const response = await get(path);
      if (response.status === null || [401, 403].includes(response.status)
        || (response.status === 404 && response.json?.error?.code === 'NOT_FOUND')) {
        record(caseId, 'PENDING', `${path}: HTTP ${response.status ?? 'unreachable/redirect refused'}; list API unavailable or protected`);
        continue;
      }
      if (needsVersion && response.status === 503 && response.json?.error?.code === 'KNOWLEDGE_UNAVAILABLE') {
        record(caseId, 'PENDING', `${path}: no published knowledge; list and UI states remain pending`);
        continue;
      }
      const data = response.json?.data;
      const envelope = response.status === 200 && response.json?.success === true && Array.isArray(data?.items);
      const validVersion = !needsVersion || /^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(data?.knowledgeVersion ?? '');
      record(caseId, envelope && validVersion ? 'PENDING' : 'FAIL', envelope && validVersion
        ? `${path}: list returned ${data.items.length} items; filters, provenance, UI and no-session browser checks not accepted`
        : `${path}: invalid list response (HTTP ${response.status})`);
    }
    after = await observeDeployment(target.env, fetchImpl);
  }
  const deployment = deploymentEvidence(before, after, target.commit);
  const run = { schemaVersion: 2, runId: `public-${startedAt}`, apiMode: 'real', baseUrl: target.env.key,
    commit: target.commit, startedAt, finishedAt: new Date().toISOString(),
    operator: 'tests/e2e/run-public-api-e2e.mjs', deployment, results, diagnostics };
  log(`${results.filter(r => r.status === 'PASS').length} PASS, ${results.filter(r => r.status === 'FAIL').length} FAIL, ${results.filter(r => r.status === 'PENDING').length} PENDING; GET only; full MVP is not accepted`);
  return { run, exitCode: !deployment.matches || results.some(r => r.status === 'FAIL') ? 1 : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const target = resolveReleaseTarget(args, process.env, { allowInsecure: args.includes('--local') });
  const out = args.find(arg => arg.startsWith('--out='))?.slice(6);
  if (target.problems.length || !out) {
    console.error('Usage: node tests/e2e/run-public-api-e2e.mjs --base-url=<https URL> --commit=<full SHA> --out=<file> [--local]');
    for (const problem of target.problems) console.error(problem);
    process.exitCode = 2;
  } else {
    const { run, exitCode } = await runPublicApiE2e({ target });
    writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
    process.exitCode = exitCode;
  }
}
