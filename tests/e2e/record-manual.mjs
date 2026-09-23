// J-003 manual (ui／ops) E2E result with deployment evidence.
//
//   node tests/e2e/record-manual.mjs --base-url=<https url> --commit=<40-hex sha> --operator="<real person>" \
//     --case=E2E-05 --status=PASS --evidence="<what was seen; no personal data>" [--case=... --status=... --evidence=...] \
//     --out=tests/e2e/results/<run>.json
//
// Run it right after the manual check: it reads <base-url>/kareo-version.json and refuses to write a
// countable record when the deployed commit is not the target. Use one --case/--status/--evidence triple per case.
import { writeFileSync } from 'node:fs';
import { resolveReleaseTarget } from '../../scripts/lib/release-target.mjs';
import { deploymentEvidence, observeDeployment } from './deployment-evidence.mjs';

const args = process.argv.slice(2);
const all = (name) => args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const one = (name) => all(name)[0];
const target = resolveReleaseTarget(args);
const problems = [...target.problems];
const cases = all('case');
const statuses = all('status');
const evidences = all('evidence');
if (!one('operator')) problems.push('missing --operator (the real person who did the check)');
if (!one('out')) problems.push('missing --out');
if (!cases.length || cases.length !== statuses.length || cases.length !== evidences.length) problems.push('give one --case, --status and --evidence per case');
for (const s of statuses) if (!['PASS', 'FAIL', 'PENDING'].includes(s)) problems.push(`invalid --status ${s}`);
if (problems.length) {
  console.error(`- ${problems.join('\n- ')}`);
  process.exit(2);
}

const startedAt = new Date().toISOString();
const before = await observeDeployment(target.env);
const evidence = deploymentEvidence(before, before, target.commit);
const run = {
  schemaVersion: 2,
  runId: `manual-${startedAt}`,
  apiMode: 'real',
  baseUrl: target.env.key,
  commit: target.commit,
  startedAt,
  finishedAt: new Date().toISOString(),
  operator: one('operator'),
  deployment: evidence,
  results: evidence.matches ? cases.map((caseId, i) => ({ caseId, status: statuses[i], evidence: evidences[i] })) : [],
};
writeFileSync(one('out'), `${JSON.stringify(run, null, 2)}\n`);
console.log(`Deployed ${before.commit ?? '(unknown)'} via ${before.versionUrl}${before.error ? ` — ${before.error}` : ''}`);
if (!evidence.matches) {
  console.log(`FAIL     deployed version is not ${target.commit}; results were not recorded → ${one('out')}`);
  process.exit(1);
}
console.log(`Recorded ${cases.length} case(s) → ${one('out')}`);
