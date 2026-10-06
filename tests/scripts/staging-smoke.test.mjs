import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { activeConsentVersions } from '../../scripts/lib/consent-readiness.mjs';

const SHA = 'f'.repeat(40);
async function run({ flags = [], marker = SHA, protectedMarker = false, redirectMarker = false, positional = false } = {}) {
  const seen = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://test').pathname;
    seen.push({ method: req.method, path });
    let status = 200;
    let body;
    if (path === '/app/kareo-version.json') {
      if (redirectMarker) { res.writeHead(302, { Location: '/app/login-collector' }); return res.end(); }
      if (protectedMarker) {
        res.writeHead(401, { 'Content-Type': 'text/html' });
        return res.end('<html>private-login-secret</html>');
      }
      body = { commit: marker };
    } else if (path.endsWith('/e2e-unknown-endpoint')) {
      status = 404; body = { success: false, error: { code: 'NOT_FOUND' } };
    } else if (path.endsWith('/knowledge/status')) {
      body = { success: true, data: { version: 'KB-2026-09-24-001' } };
    } else body = { success: true, data: { items: [], knowledgeVersion: 'KB-2026-09-24-001' } };
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = mkdtempSync(join(tmpdir(), 'kareo-smoke-'));
  const out = join(dir, 'run.json');
  const base = `http://127.0.0.1:${server.address().port}/app`;
  const child = spawn(process.execPath, ['scripts/smoke-staging.mjs',
    positional ? base : `--base-url=${base}`, `--commit=${SHA}`, `--out=${out}`, '--local', ...flags]);
  let log = '';
  child.stdout.on('data', data => { log += data; });
  child.stderr.on('data', data => { log += data; });
  try {
    const exit = await new Promise(resolve => child.on('close', resolve));
    return { exit, seen, log, file: existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null };
  } finally {
    server.close(); rmSync(dir, { recursive: true, force: true });
  }
}

test('staging smoke defaults to GET only and partial UI cases remain PENDING', async () => {
  for (const positional of [false, true]) {
    const r = await run({ positional });
    assert.equal(r.exit, 0);
    assert.ok(r.seen.every(request => request.method === 'GET' && request.path.startsWith('/app/')));
    assert.ok(!r.seen.some(request => /session|consent|assessment|lead/.test(request.path)));
    assert.equal(r.file.deployment.matches, true);
    assert.equal(r.seen.filter(request => request.path.endsWith('/kareo-version.json')).length, 2);
    assert.deepEqual(r.file.results.map(result => [result.caseId, result.status]),
      [['E2E-21', 'PASS'], ['E2E-44', 'PENDING'], ['E2E-48', 'PENDING']]);
  }
});

test('legacy assessment and write mode require explicit authorization before even connecting', async () => {
  for (const flags of [['--with-assessment'], ['--write-e2e'], ['--allow-writes']]) {
    const r = await run({ flags });
    assert.equal(r.exit, 2);
    assert.deepEqual(r.seen, []);
    assert.equal(r.file, null);
  }
});

test('explicit write mode cannot bypass the committed DRAFT registry', async () => {
  const r = await run({ flags: ['--write-e2e', '--allow-writes'] });
  assert.equal(r.exit, 1);
  assert.ok(r.seen.every(request => request.method === 'GET'));
  assert.equal(r.file.results[0].status, 'PENDING');
  assert.match(r.file.results[0].evidence, /ACTIVE/);
});

test('wrong SHA and protected preview stop before any API and do not retain the login body', async () => {
  for (const options of [{ marker: 'a'.repeat(40) }, { protectedMarker: true }, { redirectMarker: true }]) {
    const r = await run(options);
    assert.equal(r.exit, 1);
    assert.equal(r.seen.length, 1);
    assert.deepEqual(r.file.results, []);
    assert.equal(r.file.deployment.matches, false);
    assert.doesNotMatch(JSON.stringify(r.file) + r.log, /private-login-secret/);
  }
});

test('ACTIVE selection rejects malformed and draft combinations, and only returns request fields', () => {
  const active = { status: 'ACTIVE', disclaimerVersion: 'A', privacyVersion: 'B', termsVersion: 'C', approvedBy: 'synthetic reviewer' };
  for (const entry of [{ ...active, status: 'DRAFT' }, { ...active, privacyVersion: 'B-draft' },
    { ...active, disclaimerVersion: '' }, { ...active, termsVersion: null }]) {
    assert.equal(activeConsentVersions({ versions: [entry] }), null);
  }
  assert.deepEqual(activeConsentVersions({ versions: [active] }), { disclaimerVersion: 'A', privacyVersion: 'B', termsVersion: 'C' });
  assert.equal(activeConsentVersions(null), null);
});
