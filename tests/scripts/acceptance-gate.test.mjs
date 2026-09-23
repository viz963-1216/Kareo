// J-003: the release gate must fail on PENDING; mock or local runs never count as E2E passes.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { e2eItems, isOfficialRun, verdict } from '../../scripts/acceptance-gate.mjs';

const official = { apiMode: 'real', baseUrl: 'https://kareo-tw.netlify.app', commit: 'abc1234', date: '2026-10-14', runId: 'R1' };

test('dev mode tolerates PENDING, release mode does not', () => {
  const items = [{ status: 'PASS' }, { status: 'PENDING' }];
  assert.equal(verdict(items, 'dev').ok, true);
  assert.equal(verdict(items, 'release').ok, false);
  assert.equal(verdict([{ status: 'FAIL' }], 'dev').ok, false);
  assert.equal(verdict([{ status: 'PASS' }], 'release').ok, true);
});

test('only real https non-local runs with commit and date are official', () => {
  assert.equal(isOfficialRun(official), true);
  assert.equal(isOfficialRun({ ...official, apiMode: 'mock' }), false);
  assert.equal(isOfficialRun({ ...official, baseUrl: 'http://kareo-tw.netlify.app' }), false);
  assert.equal(isOfficialRun({ ...official, baseUrl: 'https://localhost:8888' }), false);
  assert.equal(isOfficialRun({ ...official, commit: '' }), false);
});

test('E2E cases stay PENDING without an official result; mock PASS is ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kareo-gate-'));
  const cases = join(dir, 'cases.json');
  const results = join(dir, 'results');
  mkdirSync(results);
  writeFileSync(cases, JSON.stringify({ cases: [
    { id: 'E2E-A', title: 'a', requires: ['B-005'] },
    { id: 'E2E-B', title: 'b', requires: [] },
    { id: 'E2E-C', title: 'c', requires: [] },
  ] }));
  writeFileSync(join(results, 'mock.json'), JSON.stringify({ ...official, apiMode: 'mock', results: [{ caseId: 'E2E-A', status: 'PASS' }] }));
  writeFileSync(join(results, 'real.json'), JSON.stringify({ ...official, results: [{ caseId: 'E2E-B', status: 'PASS', evidence: 'ok' }, { caseId: 'E2E-C', status: 'FAIL' }] }));
  const byId = Object.fromEntries(e2eItems(cases, results).map((i) => [i.item.split(' ')[0], i.status]));
  assert.deepEqual(byId, { 'E2E-A': 'PENDING', 'E2E-B': 'PASS', 'E2E-C': 'FAIL' });
});

test('release gate on the current repository fails (MVP not complete); dev check reports it is not acceptance', () => {
  const release = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--mode=release'], { encoding: 'utf8' });
  assert.equal(release.status, 1);
  assert.match(release.stdout, /RELEASE GATE FAILED/);
  const dev = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--mode=dev'], { encoding: 'utf8' });
  assert.match(dev.stdout, /NOT MVP acceptance|DEV CHECK FAILED/);
  const bad = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
