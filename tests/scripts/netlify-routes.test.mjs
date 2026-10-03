import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contractEndpoints, examplePath, firstRedirect, functionName, parseRedirects, routeMatches, validRoutePattern, declaresEndpoint } from '../../scripts/lib/netlify-routes.mjs';

test('numbered admin headings and table query strings retain all methods without duplicates', () => {
  const source = '## GET /api/v1/providers\n## 26.3 GET /api/v1/admin/knowledge/status\n| `GET /api/v1/admin/knowledge/status` |\n| `POST /api/v1/admin/knowledge/records/{id}/decision` |\n| `GET /api/v1/admin/knowledge/records?status=NEEDS_REVIEW` |';
  assert.deepEqual(contractEndpoints(source), [
    { method: 'GET', path: '/api/v1/providers' },
    { method: 'GET', path: '/api/v1/admin/knowledge/status' },
    { method: 'POST', path: '/api/v1/admin/knowledge/records/{id}/decision' },
    { method: 'GET', path: '/api/v1/admin/knowledge/records' },
  ]);
});

test('first matching catch-all shadows a later function, while exact list and detail remain distinct', () => {
  const list = { from: '/api/v1/providers', to: '/.netlify/functions/providers' };
  const detail = { from: '/api/v1/providers/*', to: '/.netlify/functions/providerDetail' };
  const fallback = { from: '/api/*', to: '/api-not-found.json' };
  assert.equal(functionName(firstRedirect([fallback, list], '/api/v1/providers')), null);
  assert.equal(firstRedirect([list, detail, fallback], '/api/v1/providers'), list);
  assert.equal(firstRedirect([list, detail, fallback], '/api/v1/providers/PROV-1'), detail);
  assert.equal(routeMatches(detail.from, list.from), true);
  assert.equal(firstRedirect([detail, list, fallback], list.from), detail);
  assert.equal(declaresEndpoint(detail, { path: list.from }), false);
  assert.equal(routeMatches(list.from, `${list.from}/`), true);
});

test('middle splats are rejected; named admin placeholders preserve the action suffix', () => {
  const rule = '/api/v1/admin/knowledge/records/:recordId/decision';
  assert.equal(validRoutePattern('/api/v1/admin/knowledge/records/*/decision'), false);
  assert.equal(routeMatches('/api/v1/admin/knowledge/records/*/decision', '/api/v1/admin/knowledge/records/X/decision'), false);
  assert.equal(validRoutePattern(rule), true);
  assert.equal(examplePath('/api/v1/admin/knowledge/records/{id}/decision'), '/api/v1/admin/knowledge/records/RUNTIME-CHECK/decision');
  assert.equal(routeMatches(rule, examplePath('/api/v1/admin/knowledge/records/{id}/decision')), true);
  assert.equal(routeMatches(rule, '/api/v1/admin/knowledge/records'), false);
  assert.equal(routeMatches(rule, '/api/v1/admin/knowledge/records/X/dismiss'), false);
});

test('actual contract includes ten admin routes and the three incoming API routes', () => {
  const endpoints = contractEndpoints(readFileSync('docs/API_CONTRACT.md', 'utf8'));
  assert.equal(endpoints.filter((e) => e.path.startsWith('/api/v1/admin/')).length, 10);
  for (const path of ['/api/v1/consent/withdraw', '/api/v1/providers', '/api/v1/knowledge/records']) assert.ok(endpoints.some((e) => e.path === path), path);
  assert.ok(parseRedirects(readFileSync('netlify.toml', 'utf8')).length > 0);
});

test('runtime checker without dependencies reports PENDING instead of crashing', () => {
  const root = mkdtempSync(join(tmpdir(), 'kareo-runtime-no-deps-'));
  mkdirSync(join(root, 'scripts/lib'), { recursive: true });
  mkdirSync(join(root, 'apps/api/src/functions'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  for (const p of ['scripts/check-functions-runtime.mjs', 'scripts/lib/netlify-routes.mjs', 'netlify.toml', 'docs/API_CONTRACT.md']) cpSync(p, join(root, p));
  const r = spawnSync(process.execPath, ['scripts/check-functions-runtime.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PENDING.*esbuild not installed/);
  assert.doesNotMatch(r.stderr, /ReferenceError/);
  rmSync(root, { recursive: true, force: true });
});
