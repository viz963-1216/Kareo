import { writeFileSync } from 'node:fs';
import { resolveReleaseTarget, deploymentUrl } from '../../scripts/lib/release-target.mjs';
import { observeDeployment, deploymentEvidence } from './deployment-evidence.mjs';
import { verifyFoundation } from './foundation-checks.mjs';

const args = process.argv.slice(2), target = resolveReleaseTarget(args, process.env);
const output = args.find(a => a.startsWith('--out='))?.slice(6);
if (target.problems.length || !output || !args.includes('--allow-empty-session-writes')
  || target.env.key !== 'https://kareo-tw.netlify.app') {
  console.error('Requires an exact Kareo acceptance deployment SHA, --base-url=https://kareo-tw.netlify.app, --allow-empty-session-writes and --out=file. No writes attempted.');
  process.exit(2);
}
const startedAt = new Date().toISOString(), before = await observeDeployment(target.env);
if (before.commit !== target.commit) {
  console.error('Deployment version mismatch; no writes attempted.'); process.exit(1);
}
async function call(method, path, { body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Kareo-Session-Token'] = token;
  const r = await fetch(deploymentUrl(target.env, path), {
    method, headers, redirect: 'error', signal: AbortSignal.timeout(30000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  if (r.headers.get('content-type')?.includes('application/json')) { try { json = await r.json(); } catch {} }
  else await r.body?.cancel();
  return { status: r.status, json };
}
const { results, cleanup } = await verifyFoundation({ call });
const after = await observeDeployment(target.env);
const report = { schemaVersion: 2, runId: `foundation-${startedAt}`, apiMode: 'real',
  baseUrl: target.env.key, commit: target.commit, startedAt, finishedAt: new Date().toISOString(),
  operator: 'tests/e2e/run-foundation-e2e.mjs', scope: 'EMPTY_SESSION_AND_CONSENT_DENIAL_ONLY',
  formalConsentActivated: false, deployment: deploymentEvidence(before, after, target.commit), results, cleanup };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.deployment.matches && !results.some(r => r.status === 'FAIL')
  && cleanup.length && cleanup.every(c => c.status === 'REQUEST_ACCEPTED') ? 0 : 1;
