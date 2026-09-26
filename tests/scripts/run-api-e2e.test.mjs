// J-003: the E2E runner records the deployed version it actually observed and never runs cases against
// a deployment whose version marker does not match the target commit.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const SHA = 'c'.repeat(40);
const OTHER = 'd'.repeat(40);

// Minimal stand-in for the current staging behaviour, served under the /app sub-path.
// tokens: 'none' (staging today), 'owned' (B-011a: token bound to its session), 'unchecked' (token issued but
// ownership not enforced — a defect the runner must report as FAIL).
function stub(markerFor, { tokens = 'none' } = {}) {
  let sessions = 0;
  const owner = new Map();
  const seen = [];
  let markerReads = 0;
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    seen.push(path);
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (path === '/app/kareo-version.json') {
      const marker = markerFor(markerReads++);
      if (marker === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html>'); }
      return json(200, marker);
    }
    if (path === '/app/api/v1/session' && req.method === 'POST') {
      const id = `S-${++sessions}`;
      if (tokens === 'none') return json(200, { success: true, data: { sessionId: id } });
      const token = `t${String(sessions).padStart(40, '0')}`;
      owner.set(token, id);
      return json(200, { success: true, data: { sessionId: id, sessionToken: token, expiresAt: '2026-10-14T01:00:00+08:00' } });
    }
    if (path === '/app/api/v1/session' && req.method === 'DELETE') return json(400, { success: false, error: { code: 'INVALID_REQUEST', message: '僅支援 POST /api/v1/session。' } });
    if (path === '/app/api/v1/consent' && tokens !== 'none' && !owner.has(req.headers['x-kareo-session-token'])) return json(401, { success: false, error: { code: 'SESSION_INVALID', message: '' } });
    if (path === '/app/api/v1/assessments') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        const sessionId = JSON.parse(body || '{}').sessionId;
        if (tokens === 'owned' && owner.get(req.headers['x-kareo-session-token']) !== sessionId) return json(403, { success: false, error: { code: 'FORBIDDEN', message: '' } });
        return json(403, { success: false, error: { code: 'CONSENT_REQUIRED', message: '' } });
      });
    }
    if (path === '/app/api/v1/external-services/transportation') return json(200, { success: true, data: { url: 'https://kareocar.netlify.app/', openMode: 'NEW_TAB' } });
    return json(404, { success: false, error: { code: 'NOT_FOUND', message: '此 API 尚未提供。' } });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, base: `http://127.0.0.1:${server.address().port}/app/` })));
}

async function runner(markerFor, commit = SHA, options = {}) {
  const s = await stub(markerFor, options);
  const out = join(mkdtempSync(join(tmpdir(), 'kareo-e2e-')), 'run.json');
  const child = spawn(process.execPath, ['tests/e2e/run-api-e2e.mjs', `--base-url=${s.base}`, `--commit=${commit}`, `--out=${out}`, '--local'], { env: { ...process.env, KAREO_RELEASE_COMMIT: '', KAREO_RELEASE_BASE_URL: '' } });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  const status = await new Promise((resolve) => child.on('close', resolve));
  s.server.close();
  return { status, stdout, seen: s.seen, file: JSON.parse(readFileSync(out, 'utf8')) };
}

test('matching deployment: cases run under the sub-path and evidence is recorded before and after', async () => {
  const r = await runner(() => ({ commit: SHA, commitSource: 'netlify:COMMIT_REF', context: 'production' }));
  assert.equal(r.file.deployment.matches, true);
  assert.equal(r.file.deployment.before.commit, SHA);
  assert.equal(r.file.deployment.after.commit, SHA);
  assert.equal(r.file.deployment.before.versionUrl, `${r.file.baseUrl}/kareo-version.json`);
  assert.equal(r.file.schemaVersion, 2);
  assert.match(r.file.startedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(r.file.results.length > 0);
  assert.ok(r.seen.includes('/app/api/v1/session'));
  assert.ok(r.seen.every((p) => p.startsWith('/app/')), `requests escaped the sub-path: ${r.seen}`);
});

test('claimed commit differs from the deployed version: no case runs, exit 1', async () => {
  const r = await runner(() => ({ commit: OTHER }));
  assert.equal(r.status, 1);
  assert.equal(r.file.deployment.matches, false);
  assert.equal(r.file.deployment.before.commit, OTHER);
  assert.equal(r.file.commit, SHA);
  assert.deepEqual(r.file.results, []);
  assert.ok(!r.seen.includes('/app/api/v1/session'));
});

test('no version marker (SPA fallback HTML): no evidence, no case runs, exit 1', async () => {
  const r = await runner(() => 'html');
  assert.equal(r.status, 1);
  assert.equal(r.file.deployment.before.commit, null);
  assert.match(r.file.deployment.before.error, /not JSON/);
  assert.deepEqual(r.file.results, []);
});

test('deployment changes during the run: evidence does not match, exit 1', async () => {
  const r = await runner((n) => ({ commit: n === 0 ? SHA : OTHER }));
  assert.equal(r.status, 1);
  assert.equal(r.file.deployment.matches, false);
  assert.equal(r.file.deployment.after.commit, OTHER);
  assert.match(r.stdout, /will not count this run/);
});

const matching = () => ({ commit: SHA });
const result = (file, id) => file.results.find((r) => r.caseId === id);

test('staging without tokens: token-dependent cases stay PENDING with the reason, never PASS', async () => {
  const r = await runner(matching);
  for (const id of ['E2E-01', 'E2E-17', 'E2E-18', 'E2E-37']) assert.equal(result(r.file, id).status, 'PENDING', id);
  assert.match(result(r.file, 'E2E-18').evidence, /B-011a/);
  assert.equal(result(r.file, 'E2E-19').status, 'PENDING');
  assert.match(result(r.file, 'E2E-19').evidence, /not deployed/);
  // Only behaviour staging already has can pass: JSON 404 for unknown APIs and CONSENT_REQUIRED.
  assert.deepEqual(r.file.results.filter((c) => c.status === 'PASS').map((c) => c.caseId).sort(), ['E2E-03', 'E2E-21']);
});

test('B-011a deployed: cross-session FORBIDDEN is recorded as partial evidence; unimplemented DELETE /session is PENDING', async () => {
  const r = await runner(matching, SHA, { tokens: 'owned' });
  assert.equal(result(r.file, 'E2E-01').status, 'PASS');
  assert.equal(result(r.file, 'E2E-17').status, 'PASS');
  assert.equal(result(r.file, 'E2E-18').status, 'PENDING');
  assert.match(result(r.file, 'E2E-18').evidence, /403 FORBIDDEN/);
  assert.equal(result(r.file, 'E2E-37').status, 'PENDING');
  assert.match(result(r.file, 'E2E-37').evidence, /not implemented/);
});

test('token issued but ownership not enforced: E2E-18 FAIL and exit 1', async () => {
  const r = await runner(matching, SHA, { tokens: 'unchecked' });
  assert.equal(result(r.file, 'E2E-18').status, 'FAIL');
  assert.equal(r.status, 1);
});
