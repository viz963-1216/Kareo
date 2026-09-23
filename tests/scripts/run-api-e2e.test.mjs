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
function stub(markerFor) {
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
    if (path === '/app/api/v1/session') return json(200, { success: true, data: { sessionId: 'S-1' } });
    if (path === '/app/api/v1/assessments') return json(403, { success: false, error: { code: 'CONSENT_REQUIRED', message: '' } });
    if (path === '/app/api/v1/external-services/transportation') return json(200, { success: true, data: { url: 'https://kareocar.netlify.app/', openMode: 'NEW_TAB' } });
    return json(404, { success: false, error: { code: 'NOT_FOUND', message: '此 API 尚未提供。' } });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, base: `http://127.0.0.1:${server.address().port}/app/` })));
}

async function runner(markerFor, commit = SHA) {
  const s = await stub(markerFor);
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
