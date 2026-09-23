// J-003 acceptance gate. Prints every item as PASS / FAIL / PENDING.
//
//   node scripts/acceptance-gate.mjs --mode=dev [--commit=<sha> --base-url=<url>]
//       development check: exit 1 only on FAIL. Without a target, E2E cases are PENDING (not evaluated).
//   node scripts/acceptance-gate.mjs --mode=release --commit=<40-hex sha> --base-url=<https url>
//       full MVP acceptance of that commit on that deployment: exit 1 on any FAIL or PENDING,
//       exit 2 when the target is missing or invalid. KAREO_RELEASE_COMMIT／KAREO_RELEASE_BASE_URL also work.
//
// dev exit 0 means "nothing is broken yet", never "the MVP passed". Only release exit 0 means every
// required item (static checks, knowledge, provider data, and all real-API E2E cases) has passed.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deploymentUrl, isFullSha, normalizeEnvironment, resolveReleaseTarget, VERSION_MARKER } from './lib/release-target.mjs';

function run(script, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

export function staticItems() {
  const items = [];
  const integration = run('scripts/check-integration.mjs');
  for (const line of integration.out.split('\n')) {
    const m = line.match(/^(PASS|FAIL|PENDING)\s+(.+?)\s{2,}(.*)$/);
    if (m) items.push({ status: m[1], item: `integration: ${m[2].trim()}`, detail: m[3].trim() });
  }
  if (integration.status !== 0 && !items.some((i) => i.status === 'FAIL')) {
    items.push({ status: 'FAIL', item: 'integration checks', detail: `exited ${integration.status}` });
  }

  const pack = run('scripts/validate-knowledge-pack.mjs', ['.']);
  items.push({
    status: pack.status !== 0 ? 'FAIL' : /^PENDING/m.test(pack.out) ? 'PENDING' : 'PASS',
    item: 'knowledge pack format',
    detail: pack.out.trim().split('\n').pop(),
  });
  items.push(knowledgeApprovalItem());

  const provider = run('scripts/check-provider-data.mjs');
  items.push({
    status: provider.status !== 0 ? 'FAIL' : /PENDING/.test(provider.out) ? 'PENDING' : 'PASS',
    item: 'provider data gate (A-004)',
    detail: provider.out.trim().split('\n').pop(),
  });
  return items;
}

// Format validity is not approval: at least one pack record must be APPROVED by a named reviewer.
function knowledgeApprovalItem() {
  const dir = 'contracts/knowledge/packs';
  if (!existsSync(dir)) return { status: 'PENDING', item: 'knowledge content approved', detail: 'no content packs' };
  let approved = 0;
  let total = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const pack = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const record of pack.records ?? []) {
      total++;
      if (record.status === 'APPROVED' && record.review?.reviewedBy) approved++;
    }
  }
  return {
    status: approved > 0 ? 'PASS' : 'PENDING',
    item: 'knowledge content approved',
    detail: `${approved}/${total} records APPROVED with a reviewer (publishing is verified by E2E-25)`,
  };
}

const STATUSES = new Set(['PASS', 'FAIL', 'PENDING']);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const timestamp = (v) => (typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : undefined);

// Format check of one result file (schemaVersion 2, see tests/e2e/results/README.md). Returns problems[].
export function validateRun(run, caseIds) {
  const p = [];
  if (!run || typeof run !== 'object' || Array.isArray(run)) return ['not a JSON object'];
  if (run.schemaVersion !== 2) p.push(`schemaVersion must be 2 (got ${JSON.stringify(run.schemaVersion)}; date-only files cannot be ordered)`);
  for (const k of ['runId', 'apiMode', 'baseUrl', 'commit', 'operator']) if (typeof run[k] !== 'string' || !run[k]) p.push(`missing ${k}`);
  const started = timestamp(run.startedAt);
  const finished = timestamp(run.finishedAt);
  if (started === undefined) p.push(`startedAt must be a full ISO timestamp with time zone (got ${JSON.stringify(run.startedAt)})`);
  if (finished === undefined) p.push(`finishedAt must be a full ISO timestamp with time zone (got ${JSON.stringify(run.finishedAt)})`);
  if (started !== undefined && finished !== undefined && finished < started) p.push('finishedAt is before startedAt');
  if (!Array.isArray(run.results)) p.push('results must be an array');
  const seen = new Set();
  for (const [i, r] of (Array.isArray(run.results) ? run.results : []).entries()) {
    if (typeof r?.caseId !== 'string') { p.push(`results[${i}] missing caseId`); continue; }
    if (caseIds && !caseIds.has(r.caseId)) p.push(`results[${i}] unknown caseId ${r.caseId}`);
    if (seen.has(r.caseId)) p.push(`results[${i}] duplicate caseId ${r.caseId}`);
    seen.add(r.caseId);
    if (!STATUSES.has(r.status)) p.push(`results[${i}] ${r.caseId} status must be PASS／FAIL／PENDING (got ${JSON.stringify(r.status)})`);
    if (r.recordedAt !== undefined) {
      const at = timestamp(r.recordedAt);
      if (at === undefined) p.push(`results[${i}] ${r.caseId} recordedAt is not a full ISO timestamp`);
      else if (started !== undefined && finished !== undefined && (at < started || at > finished)) p.push(`results[${i}] ${r.caseId} recordedAt is outside startedAt..finishedAt`);
    }
  }
  return p;
}

// Deployment evidence must show the target commit at this environment's version marker, before and after.
function evidenceProblem(run, target) {
  const d = run.deployment;
  if (!d || typeof d !== 'object') return 'no deployment evidence (deployment block missing)';
  const expectedUrl = deploymentUrl(target.env, VERSION_MARKER).href;
  for (const [label, o] of [['before', d.before], ['after', d.after]]) {
    if (!o || typeof o !== 'object') return `no deployment evidence (${label} observation missing)`;
    if (o.versionUrl !== expectedUrl) return `deployment evidence (${label}) read ${o.versionUrl ?? '?'}, not ${expectedUrl}`;
    if (timestamp(o.fetchedAt) === undefined) return `deployment evidence (${label}) has no valid fetchedAt`;
    if (!isFullSha(o.commit)) return `deployed version unknown (${label}: ${o.error ?? 'no commit'})`;
    if (o.commit !== target.commit) return `deployed version mismatch (${label}: observed ${o.commit.slice(0, 12)}, claimed ${target.commit.slice(0, 12)})`;
  }
  return undefined;
}

// Decides what one parsed result file means for this target: { use } | { ignore: reason } | { fail: reason }.
export function classifyRun(run, target, caseIds) {
  const problems = validateRun(run, caseIds);
  if (problems.length) return { fail: `invalid result file: ${problems.join('; ')}` };
  if (run.apiMode !== 'real') return { ignore: `apiMode ${run.apiMode}` };
  const env = normalizeEnvironment(run.baseUrl);
  if (env.error) return { ignore: `baseUrl ${env.error}` };
  if (!target) return { ignore: 'no release target given (dev check does not evaluate E2E results)' };
  if (env.key !== target.env.key) return { ignore: `environment ${env.key} is not the target ${target.env.key}` };
  if (run.commit !== target.commit) return { ignore: `commit ${String(run.commit).slice(0, 12)} is not the target ${target.commit.slice(0, 12)}` };
  const bad = evidenceProblem(run, target);
  if (bad) return { fail: bad };
  return { use: true };
}

// Reads every result file. Returns { runs: [{file, run}], broken: [{file, reason}] }.
export function loadRuns(resultsDir) {
  const runs = [];
  const broken = [];
  if (!existsSync(resultsDir)) return { runs, broken };
  for (const file of readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort()) {
    try {
      runs.push({ file, run: JSON.parse(readFileSync(join(resultsDir, file), 'utf8')) });
    } catch (e) {
      broken.push({ file, reason: `corrupt JSON: ${e.message}` });
    }
  }
  return { runs, broken };
}

// E2E items for one release target (commit + environment). Only runs for exactly that target with matching
// deployment evidence count, so results from different commits or environments are never combined.
// Per case, the most recent result wins whatever its status (recordedAt, else the run's finishedAt):
// a newer FAIL or PENDING replaces an older PASS. Two latest results at the same instant with different
// statuses cannot be ordered and FAIL. Returns { items, ignored }.
export function e2eItems(target, casesFile = 'tests/e2e/acceptance-cases.json', resultsDir = 'tests/e2e/results') {
  const { cases } = JSON.parse(readFileSync(casesFile, 'utf8'));
  const caseIds = new Set(cases.map((c) => c.id));
  const { runs, broken } = loadRuns(resultsDir);
  const items = broken.map((b) => ({ status: 'FAIL', item: `E2E result ${b.file}`, detail: b.reason }));
  const ignored = [];
  const byCase = new Map();
  for (const { file, run } of runs) {
    const c = classifyRun(run, target, caseIds);
    if (c.ignore) { ignored.push({ file, reason: c.ignore }); continue; }
    if (c.fail) { items.push({ status: 'FAIL', item: `E2E result ${file}`, detail: c.fail }); continue; }
    for (const r of run.results) {
      const at = timestamp(r.recordedAt ?? run.finishedAt);
      if (!byCase.has(r.caseId)) byCase.set(r.caseId, []);
      byCase.get(r.caseId).push({ ...r, at, file, runId: run.runId });
    }
  }
  for (const c of cases) {
    const title = `${c.id} ${c.title}`;
    const found = (byCase.get(c.id) ?? []).sort((x, y) => y.at - x.at);
    const [latest, previous] = found;
    if (!latest) {
      const why = !target ? 'dev check without a release target: E2E results not evaluated'
        : c.requires.length ? `no result for this target; waiting for ${c.requires.join(', ')}` : 'no result for this target';
      items.push({ status: 'PENDING', item: title, detail: why });
      continue;
    }
    if (previous && previous.at === latest.at && previous.status !== latest.status) {
      items.push({ status: 'FAIL', item: title, detail: `cannot order ${latest.runId} (${latest.status}) and ${previous.runId} (${previous.status}): same timestamp` });
      continue;
    }
    const when = new Date(latest.at).toISOString();
    items.push({ status: latest.status, item: title, detail: `${latest.runId} @ ${when}: ${latest.evidence ?? latest.detail ?? ''}${found.length > 1 ? ` (latest of ${found.length})` : ''}` });
  }
  return { items, ignored };
}

export function verdict(items, mode) {
  const fail = items.filter((i) => i.status === 'FAIL').length;
  const pending = items.filter((i) => i.status === 'PENDING').length;
  const pass = items.length - fail - pending;
  const ok = mode === 'release' ? fail === 0 && pending === 0 : fail === 0;
  return { pass, fail, pending, ok };
}

function main() {
  const argv = process.argv.slice(2);
  const modeArg = argv.find((a) => a.startsWith('--mode='));
  const mode = modeArg?.split('=')[1];
  if (mode !== 'dev' && mode !== 'release') {
    console.error('Usage: node scripts/acceptance-gate.mjs --mode=dev|release [--commit=<40-hex sha> --base-url=<https url>]');
    return 2;
  }
  const resolved = resolveReleaseTarget(argv);
  const given = argv.some((a) => /^--(commit|base-url)\b/.test(a)) || process.env.KAREO_RELEASE_COMMIT || process.env.KAREO_RELEASE_BASE_URL;
  if (resolved.problems.length && (mode === 'release' || given)) {
    console.error(`RELEASE TARGET INVALID:\n- ${resolved.problems.join('\n- ')}`);
    return 2;
  }
  const target = resolved.problems.length ? undefined : { commit: resolved.commit, env: resolved.env };
  const e2e = e2eItems(target);
  const items = [...staticItems(), ...e2e.items];
  console.log(target ? `Target: ${target.commit} @ ${target.env.key}\n` : 'Target: none (dev check; E2E results are not evaluated)\n');
  for (const i of items) console.log(`${i.status.padEnd(8)} ${i.item}${i.detail ? ` — ${i.detail}` : ''}`);
  for (const g of e2e.ignored) console.log(`IGNORED  E2E result ${g.file} — ${g.reason}`);
  const v = verdict(items, mode);
  const label = mode === 'release'
    ? v.ok ? 'RELEASE GATE PASSED: every required MVP item passed for this commit and deployment.' : 'RELEASE GATE FAILED: required MVP items are failing or pending.'
    : v.ok ? 'DEV CHECK OK: no FAIL. PENDING items are not passed; this is NOT MVP acceptance.' : 'DEV CHECK FAILED.';
  console.log(`\nSummary (${mode}): ${v.pass} PASS, ${v.fail} FAIL, ${v.pending} PENDING, ${e2e.ignored.length} result file(s) ignored\n${label}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const esc = (t) => String(t ?? '').replace(/\|/g, '\\|');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Acceptance gate (${mode})\n\n${target ? `Target \`${target.commit}\` @ ${target.env.key}` : 'No release target'}\n\n${label}\n\n| Status | Item | Detail |\n|---|---|---|\n${[...items, ...e2e.ignored.map((g) => ({ status: 'IGNORED', item: g.file, detail: g.reason }))].map((i) => `| ${i.status} | ${esc(i.item)} | ${esc(i.detail)} |`).join('\n')}\n\n`);
  }
  return v.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
