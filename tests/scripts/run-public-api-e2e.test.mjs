import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
const SHA = 'b'.repeat(40);
async function run({ marker = SHA, invalid = false } = {}) {
  const seen = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    seen.push({ method: req.method, path });
    let status = 200;
    let body;
    if (path === '/app/kareo-version.json') body = { commit: marker };
    else if (path === '/app/api/v1/e2e-unknown-endpoint') { status = 404; body = { success: false, error: { code: 'NOT_FOUND' } }; }
    else if (path.endsWith('/knowledge/status')) body = { success: true, data: { version: 'KB-2026-09-24-001' } };
    else body = { success: true, data: invalid ? {} : { items: [], knowledgeVersion: 'KB-2026-09-24-001' } };
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const dir = mkdtempSync(join(tmpdir(), 'kareo-public-test-'));
  const out = join(dir, 'run.json');
  const child = spawn(process.execPath, ['tests/e2e/run-public-api-e2e.mjs', `--base-url=http://127.0.0.1:${server.address().port}/app`, `--commit=${SHA}`, `--out=${out}`, '--local']);
  child.stdout.resume(); child.stderr.resume();
  try {
    const exit = await new Promise((resolve) => child.on('close', resolve));
    return { exit, seen, file: JSON.parse(readFileSync(out, 'utf8')) };
  } finally { server.close(); rmSync(dir, { recursive: true, force: true }); }
}

test('public runner uses GET only, verifies the version twice and never passes whole UI cases', async () => {
  const r = await run();
  assert.equal(r.exit, 0);
  assert.ok(r.seen.every((p) => p.method === 'GET' && p.path.startsWith('/app/')));
  assert.ok(!r.seen.some((p) => p.path.includes('/session') || p.path.includes('/consent')));
  assert.equal(r.file.deployment.matches, true);
  assert.equal(r.seen.filter((p) => p.path === '/app/kareo-version.json').length, 2);
  assert.deepEqual(r.file.results.map((p) => [p.caseId, p.status]), [['E2E-21', 'PASS'], ['E2E-44', 'PENDING'], ['E2E-48', 'PENDING']]);
});

test('public runner rejects success envelopes without list data', async () => {
  const r = await run({ invalid: true });
  assert.equal(r.exit, 1);
  assert.equal(r.file.results.find((p) => p.caseId === 'E2E-48').status, 'FAIL');
});

test('public runner never runs cases for a mismatched deployment', async () => {
  const r = await run({ marker: 'a'.repeat(40) });
  assert.equal(r.exit, 1);
  assert.deepEqual(r.file.results, []);
  assert.equal(r.seen.length, 1);
});
