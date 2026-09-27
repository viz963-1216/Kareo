// J-003: the release gate counts only results for the exact target commit and deployment, proven by the
// deployed version marker; it never combines commits or environments, and the latest result per case wins.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { caseIntegrityItems, e2eItems, verdict } from '../../scripts/acceptance-gate.mjs';
import { normalizeEnvironment, resolveReleaseTarget } from '../../scripts/lib/release-target.mjs';

const SHA = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const BASE = 'https://kareo-tw.netlify.app';
const target = (commit = SHA, base = BASE) => ({ commit, env: normalizeEnvironment(base) });

function observed(commit, base = BASE, fetchedAt = '2026-10-14T01:00:00.000Z') {
  return { versionUrl: new URL('kareo-version.json', normalizeEnvironment(base).url).href, fetchedAt, commit };
}
function run({ commit = SHA, base = BASE, deployed = commit, at = '2026-10-14T01:00:00.000Z', results, ...rest }) {
  return {
    schemaVersion: 2, runId: `R-${at}-${commit.slice(0, 4)}`, apiMode: 'real', baseUrl: base, commit,
    startedAt: at, finishedAt: at, operator: 'test',
    deployment: { method: 'kareo-version.json', targetCommit: commit, before: observed(deployed, base), after: observed(deployed, base), matches: deployed === commit },
    results, ...rest,
  };
}

function gate(files, t = target()) {
  const dir = mkdtempSync(join(tmpdir(), 'kareo-gate-'));
  const cases = join(dir, 'cases.json');
  const results = join(dir, 'results');
  mkdirSync(results);
  writeFileSync(cases, JSON.stringify({ cases: ['E2E-A', 'E2E-B'].map((id) => ({ id, title: id.toLowerCase(), requires: [] })) }));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(results, name), typeof content === 'string' ? content : JSON.stringify(content));
  const { items, ignored } = e2eItems(t, cases, results);
  const status = Object.fromEntries(items.map((i) => [i.item.split(' ').slice(0, i.item.startsWith('E2E result') ? 3 : 1).join(' '), i.status]));
  return { items, ignored, status, release: verdict(items, 'release').ok };
}
const both = (s) => [{ caseId: 'E2E-A', status: s, evidence: 'x' }, { caseId: 'E2E-B', status: s, evidence: 'x' }];

test('dev mode tolerates PENDING, release mode does not', () => {
  const items = [{ status: 'PASS' }, { status: 'PENDING' }];
  assert.equal(verdict(items, 'dev').ok, true);
  assert.equal(verdict(items, 'release').ok, false);
  assert.equal(verdict([{ status: 'FAIL' }], 'dev').ok, false);
  assert.equal(verdict([{ status: 'PASS' }], 'release').ok, true);
});

test('release target needs a full SHA and a deployed https URL (flags or env)', () => {
  assert.equal(resolveReleaseTarget([], {}).problems.length, 2);
  assert.match(resolveReleaseTarget([`--commit=abc1234`, `--base-url=${BASE}`], {}).problems[0], /40-character/);
  assert.match(resolveReleaseTarget([`--commit=${SHA}`, '--base-url=https://localhost:8888'], {}).problems[0], /deployed host/);
  assert.match(resolveReleaseTarget([`--commit=${SHA}`, '--base-url=http://kareo-tw.netlify.app'], {}).problems[0], /https/);
  const ok = resolveReleaseTarget([], { KAREO_RELEASE_COMMIT: SHA, KAREO_RELEASE_BASE_URL: 'https://Kareo-TW.netlify.app:443/app/' });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.env.key, 'https://kareo-tw.netlify.app/app');
});

test('URL normalization uses the parser and keeps sub-paths distinct', () => {
  assert.equal(normalizeEnvironment('https://KAREO-TW.netlify.app:443/').key, normalizeEnvironment(BASE).key);
  assert.notEqual(normalizeEnvironment(`${BASE}/app`).key, normalizeEnvironment(`${BASE}/app2`).key);
  assert.notEqual(normalizeEnvironment(`${BASE}/app`).key, normalizeEnvironment(BASE).key);
  assert.notEqual(normalizeEnvironment('https://kareo-tw.netlify.app.evil.example').key, normalizeEnvironment(BASE).key);
  assert.ok(normalizeEnvironment('https://user:pw@kareo-tw.netlify.app').error);
});

test('correct commit + environment + evidence counts', () => {
  const g = gate({ 'ok.json': run({ results: both('PASS') }) });
  assert.deepEqual([g.status['E2E-A'], g.status['E2E-B']], ['PASS', 'PASS']);
  assert.equal(g.release, true);
});

test('reproduced bug: an old unrelated PASS on another host is ignored with a reason', () => {
  const legacy = { runId: 'old', apiMode: 'real', baseUrl: 'https://other.example.com', commit: 'old-unrelated-commit', date: '2020-01-01', results: both('PASS') };
  const g = gate({ 'legacy.json': { ...run({ base: 'https://other.example.com', commit: OLD, at: '2020-01-01T00:00:00Z', results: both('PASS') }) } });
  assert.equal(g.status['E2E-A'], 'PENDING');
  assert.match(g.ignored[0].reason, /environment https:\/\/other\.example\.com/);
  assert.equal(g.release, false);
  // The original date-only record is not even a valid file any more.
  assert.equal(gate({ 'legacy.json': legacy }).status['E2E result legacy.json'], 'FAIL');
});

test('right environment but old commit is not counted', () => {
  const g = gate({ 'old.json': run({ commit: OLD, results: both('PASS') }) });
  assert.deepEqual([g.status['E2E-A'], g.status['E2E-B']], ['PENDING', 'PENDING']);
  assert.match(g.ignored[0].reason, /commit bbbb.* is not the target aaaa/);
  assert.equal(g.release, false);
});

test('right commit but another environment (including another sub-path) is not counted', () => {
  for (const base of ['https://kareo-staging.netlify.app', `${BASE}/app2`]) {
    const g = gate({ 'other.json': run({ base, results: both('PASS') }) }, target(SHA, `${BASE}/app`));
    assert.equal(g.status['E2E-A'], 'PENDING', base);
    assert.match(g.ignored[0].reason, /is not the target/);
  }
  // Equivalent spellings of the same deployment are the same environment.
  const same = gate({ 'same.json': run({ base: 'https://KAREO-TW.netlify.app:443/app/', results: both('PASS') }) }, target(SHA, `${BASE}/app`));
  assert.equal(same.status['E2E-A'], 'PASS');
});

test('different versions each passing some cases cannot be combined', () => {
  const g = gate({
    'a.json': run({ commit: SHA, results: [{ caseId: 'E2E-A', status: 'PASS' }] }),
    'b.json': run({ commit: OLD, at: '2026-10-15T00:00:00Z', results: [{ caseId: 'E2E-B', status: 'PASS' }] }),
  });
  assert.deepEqual([g.status['E2E-A'], g.status['E2E-B']], ['PASS', 'PENDING']);
  assert.equal(g.release, false);
});

test('claimed commit differs from the deployed version → FAIL; missing evidence → FAIL', () => {
  const mismatch = gate({ 'm.json': run({ deployed: OLD, results: both('PASS') }) });
  assert.equal(mismatch.status['E2E result m.json'], 'FAIL');
  assert.match(mismatch.items[0].detail, /deployed version mismatch/);
  assert.equal(mismatch.status['E2E-A'], 'PENDING');
  assert.equal(mismatch.release, false);

  const changedDuringRun = run({ results: both('PASS') });
  changedDuringRun.deployment.after = observed(OLD);
  assert.equal(gate({ 'c.json': changedDuringRun }).status['E2E result c.json'], 'FAIL');

  const noEvidence = run({ results: both('PASS') });
  delete noEvidence.deployment;
  assert.match(gate({ 'n.json': noEvidence }).items[0].detail, /no deployment evidence/);

  const unknown = run({ results: both('PASS') });
  unknown.deployment.before = { ...observed(SHA), commit: null, error: 'version marker unreachable' };
  assert.match(gate({ 'u.json': unknown }).items[0].detail, /deployed version unknown/);

  const otherMarker = run({ results: both('PASS') });
  otherMarker.deployment.before = observed(SHA, 'https://other.example.com');
  assert.match(gate({ 'o.json': otherMarker }).items[0].detail, /read https:\/\/other\.example\.com/);
});

test('same version and environment: a later FAIL or PENDING replaces an earlier PASS', () => {
  const fail = gate({
    '1.json': run({ at: '2026-10-14T01:00:00Z', results: both('PASS') }),
    '2.json': run({ at: '2026-10-14T09:30:00Z', results: [{ caseId: 'E2E-A', status: 'FAIL' }] }),
  });
  assert.deepEqual([fail.status['E2E-A'], fail.status['E2E-B']], ['FAIL', 'PASS']);
  assert.equal(fail.release, false);

  const pending = gate({
    // File names sort in the opposite order to time: ordering must come from timestamps.
    'z-old.json': run({ at: '2026-10-14T01:00:00Z', results: both('PASS') }),
    'a-new.json': run({ at: '2026-10-14T01:00:01+08:00', results: [] }),
    'm-newest.json': run({ at: '2026-10-14T02:00:00Z', results: [{ caseId: 'E2E-B', status: 'PENDING' }] }),
  });
  assert.deepEqual([pending.status['E2E-A'], pending.status['E2E-B']], ['PASS', 'PENDING']);
  assert.equal(pending.release, false);

  // Merging runs of the same target is allowed: newer PASS after older FAIL passes.
  const fixed = gate({
    '1.json': run({ at: '2026-10-14T01:00:00Z', results: both('FAIL') }),
    '2.json': run({ at: '2026-10-14T02:00:00Z', results: both('PASS') }),
  });
  assert.equal(fixed.release, true);
});

test('results that cannot be ordered FAIL', () => {
  const g = gate({
    '1.json': run({ at: '2026-10-14T01:00:00.000Z', results: [{ caseId: 'E2E-A', status: 'PASS' }] }),
    '2.json': { ...run({ at: '2026-10-14T01:00:00.000Z', results: [{ caseId: 'E2E-A', status: 'FAIL' }] }), runId: 'R-other' },
  });
  assert.equal(g.status['E2E-A'], 'FAIL');
  assert.match(g.items.find((i) => i.item.startsWith('E2E-A')).detail, /same timestamp/);
});

test('missing fields, invalid times, bad statuses and corrupt JSON fail explicitly', () => {
  const bad = {
    'corrupt.json': '{"runId": ',
    'no-commit.json': { ...run({ results: both('PASS') }), commit: undefined },
    'date-only.json': { ...run({ results: both('PASS') }), finishedAt: '2026-10-14' },
    'no-zone.json': { ...run({ results: both('PASS') }), startedAt: '2026-10-14T01:00:00' },
    'nonsense-time.json': { ...run({ results: both('PASS') }), finishedAt: '2026-13-45T99:00:00Z' },
    'status.json': run({ results: [{ caseId: 'E2E-A', status: 'OK' }] }),
    'unknown-case.json': run({ results: [{ caseId: 'E2E-Z', status: 'PASS' }] }),
    'schema.json': { ...run({ results: both('PASS') }), schemaVersion: 1 },
    'recorded-outside.json': run({ results: [{ caseId: 'E2E-A', status: 'PASS', recordedAt: '2030-01-01T00:00:00Z' }] }),
  };
  for (const [name, content] of Object.entries(bad)) {
    const g = gate({ [name]: content, 'good.json': run({ at: '2026-10-13T00:00:00Z', results: both('PASS') }) });
    assert.equal(g.status[`E2E result ${name}`], 'FAIL', name);
    assert.equal(g.release, false, name);
    assert.equal(verdict(g.items, 'dev').ok, false, name);
  }
});

test('no matching record → PENDING and release fails; mock runs are ignored', () => {
  const none = gate({});
  assert.deepEqual([none.status['E2E-A'], none.status['E2E-B']], ['PENDING', 'PENDING']);
  assert.equal(none.release, false);
  const mock = gate({ 'mock.json': { ...run({ results: both('PASS') }), apiMode: 'mock' } });
  assert.equal(mock.status['E2E-A'], 'PENDING');
  assert.match(mock.ignored[0].reason, /apiMode mock/);
});

test('dev check without a target does not evaluate E2E results', () => {
  const g = gate({ 'ok.json': run({ results: both('PASS') }) }, null);
  assert.equal(g.status['E2E-A'], 'PENDING');
  assert.match(g.items.find((i) => i.item.startsWith('E2E-A')).detail, /not MVP|not evaluated/);
});

test('CLI: release needs a target; the current repository still fails release (MVP not complete)', () => {
  const node = (...a) => spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', ...a], { encoding: 'utf8', env: { ...process.env, KAREO_RELEASE_COMMIT: '', KAREO_RELEASE_BASE_URL: '' } });
  const missing = node('--mode=release');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing target commit[\s\S]*missing target deployment/);
  assert.equal(node('--mode=release', `--commit=${SHA}`).status, 2);
  assert.equal(node('--mode=release', `--base-url=${BASE}`).status, 2);
  assert.equal(node('--mode=release', '--commit=abc1234', `--base-url=${BASE}`).status, 2);

  const release = node('--mode=release', `--commit=${SHA}`, `--base-url=${BASE}`);
  assert.equal(release.status, 1);
  assert.match(release.stdout, /RELEASE GATE FAILED/);
  const dev = node('--mode=dev');
  assert.match(dev.stdout, /NOT MVP acceptance|DEV CHECK FAILED/);
  assert.equal(node().status, 2);
});

function integrity(cases, traceMd) {
  const dir = mkdtempSync(join(tmpdir(), 'kareo-cases-'));
  writeFileSync(join(dir, 'cases.json'), JSON.stringify({ cases }));
  writeFileSync(join(dir, 'trace.md'), traceMd);
  return caseIntegrityItems(join(dir, 'cases.json'), join(dir, 'trace.md'))[0];
}
const c = (id, extra = {}) => ({ id, kind: 'api', title: id, spec: 's', requires: [], trace: [1], ...extra });
const TRACE = '## 1. 初評\n| a | E2E-01／02 |\n## 2. 補助\n| b | E2E-03 |\n';

test('case integrity: every traced case exists, every case is traced, every section has a case', () => {
  assert.equal(integrity([c('E2E-01'), c('E2E-02'), c('E2E-03', { trace: [2] })], TRACE).status, 'PASS');
});

test('case integrity: deleting a case that MVP_TRACEABILITY references fails the gate', () => {
  const r = integrity([c('E2E-01'), c('E2E-03', { trace: [2] })], TRACE);
  assert.equal(r.status, 'FAIL');
  assert.match(r.detail, /missing from the case list: E2E-02/);
});

test('case integrity: untraced cases, uncovered sections and malformed cases fail', () => {
  assert.match(integrity([c('E2E-01'), c('E2E-02'), c('E2E-03', { trace: [2] }), c('E2E-04', { trace: [2] })], TRACE).detail, /not referenced .*E2E-04/);
  assert.match(integrity([c('E2E-01'), c('E2E-02'), c('E2E-03')], TRACE).detail, /sections without a case: 2/);
  assert.match(integrity([c('E2E-01', { kind: 'mock' }), c('E2E-02'), c('E2E-03', { trace: [2] })], TRACE).detail, /kind must be/);
  assert.match(integrity([c('E2E-01'), c('E2E-01'), c('E2E-02'), c('E2E-03', { trace: [2] })], TRACE).detail, /duplicate id/);
});
