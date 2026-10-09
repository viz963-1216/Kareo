import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolveReleaseTarget, deploymentUrl } from '../../scripts/lib/release-target.mjs';
import { observeDeployment, deploymentEvidence } from './deployment-evidence.mjs';
import { verifyTokenExpiry } from './token-expiry-checks.mjs';

const args = process.argv.slice(2), target = resolveReleaseTarget(args);
const out = args.find(a => a.startsWith('--out='))?.slice(6);
if (target.problems.length || !out || target.env.key !== 'https://kareo-tw.netlify.app'
  || !args.includes('--allow-empty-session-writes') || !args.includes('--connector-expiry-coordination')) {
  console.error('Exact Kareo acceptance URL/SHA, output and explicit empty-fixture/connector flags required. No writes attempted.');
  process.exit(2);
}
const before = await observeDeployment(target.env), startedAt = new Date().toISOString();
if (before.commit !== target.commit) { console.error('Version mismatch; no writes attempted.'); process.exit(1); }
const input = createInterface({ input: process.stdin, terminal: false });
const lines = input[Symbol.asyncIterator]();
async function coordinate(action, sql) {
  console.log(JSON.stringify({ connectorAction: action, projectRef: 'ojawadobnaxduxybqolk', sql }));
  const line = await lines.next();
  if (line.done || line.value.trim() !== `${action}-confirmed`) throw Error('COORDINATION_NOT_CONFIRMED');
}
async function call(method, path, { body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Kareo-Session-Token'] = token;
  const r = await fetch(deploymentUrl(target.env, path), { method, headers, redirect: 'error',
    signal: AbortSignal.timeout(30000), body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { if (r.headers.get('content-type')?.includes('application/json')) json = await r.json(); else await r.body?.cancel(); } catch {}
  return { status: r.status, json };
}
const checked = await verifyTokenExpiry({ call, coordinate });
input.close();
const after = await observeDeployment(target.env);
const report = { schemaVersion: 2, runId: `token-expiry-${startedAt}`, apiMode: 'real',
  baseUrl: target.env.key, commit: target.commit, startedAt, finishedAt: new Date().toISOString(),
  operator: 'Codex connector-coordinated empty acceptance fixture',
  scope: 'TOKEN_REJECTION_ONLY_NO_PERSONAL_PAYLOAD', formalConsentActivated: false,
  deployment: deploymentEvidence(before, after, target.commit), ...checked };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = report.deployment.matches && checked.results[0].status === 'PASS' ? 0 : 1;
