// J-003 acceptance gate. Prints every item as PASS / FAIL / PENDING.
//
//   node scripts/acceptance-gate.mjs --mode=dev      development check: exit 1 only on FAIL
//   node scripts/acceptance-gate.mjs --mode=release  full MVP acceptance: exit 1 on any FAIL or PENDING
//
// dev exit 0 means "nothing is broken yet", never "the MVP passed". Only release exit 0 means every
// required item (static checks, knowledge, provider data, and all real-API E2E cases) has passed.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

export function isOfficialRun(run) {
  if (run?.apiMode !== 'real' || !run.commit || !run.date) return false;
  try {
    const url = new URL(run.baseUrl);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function e2eItems(casesFile = 'tests/e2e/acceptance-cases.json', resultsDir = 'tests/e2e/results') {
  const { cases } = JSON.parse(readFileSync(casesFile, 'utf8'));
  const latest = new Map();
  const runs = existsSync(resultsDir)
    ? readdirSync(resultsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')))
    : [];
  for (const r of runs.filter(isOfficialRun).sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    for (const result of r.results ?? []) latest.set(result.caseId, { ...result, runId: r.runId, commit: r.commit });
  }
  return cases.map((c) => {
    const result = latest.get(c.id);
    const title = `${c.id} ${c.title}`;
    if (!result || !['PASS', 'FAIL'].includes(result.status)) {
      const waiting = c.requires.length ? `waiting for ${c.requires.join(', ')}` : 'not run against a real deployment';
      return { status: 'PENDING', item: title, detail: result?.detail ?? waiting };
    }
    return { status: result.status, item: title, detail: `${result.runId} @ ${String(result.commit).slice(0, 7)}: ${result.evidence ?? ''}` };
  });
}

export function verdict(items, mode) {
  const fail = items.filter((i) => i.status === 'FAIL').length;
  const pending = items.filter((i) => i.status === 'PENDING').length;
  const pass = items.length - fail - pending;
  const ok = mode === 'release' ? fail === 0 && pending === 0 : fail === 0;
  return { pass, fail, pending, ok };
}

function main() {
  const modeArg = process.argv.find((a) => a.startsWith('--mode='));
  const mode = modeArg?.split('=')[1];
  if (mode !== 'dev' && mode !== 'release') {
    console.error('Usage: node scripts/acceptance-gate.mjs --mode=dev|release');
    return 2;
  }
  const items = [...staticItems(), ...e2eItems()];
  for (const i of items) console.log(`${i.status.padEnd(8)} ${i.item}${i.detail ? ` — ${i.detail}` : ''}`);
  const v = verdict(items, mode);
  const label = mode === 'release'
    ? v.ok ? 'RELEASE GATE PASSED: every required MVP item passed.' : 'RELEASE GATE FAILED: required MVP items are failing or pending.'
    : v.ok ? 'DEV CHECK OK: no FAIL. PENDING items are not passed; this is NOT MVP acceptance.' : 'DEV CHECK FAILED.';
  console.log(`\nSummary (${mode}): ${v.pass} PASS, ${v.fail} FAIL, ${v.pending} PENDING\n${label}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Acceptance gate (${mode})\n\n${label}\n\n| Status | Item | Detail |\n|---|---|---|\n${items.map((i) => `| ${i.status} | ${i.item} | ${String(i.detail ?? '').replace(/\|/g, '\\|')} |`).join('\n')}\n\n`);
  }
  return v.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
