import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeRelease } from '../smoke-release.mjs';
const commit = 'a'.repeat(40);
const knowledgeVersion = 'KB-2026-09-24-001';
const env = { url: new URL('https://example.test/'), key: 'https://example.test' };
function fixture(overrides = {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body, undefined);
    const path = url.pathname;
    if (overrides[path]) return overrides[path]();
    if (path === '/') return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    if (path === '/kareo-version.json') return Response.json({ commit });
    if (path === '/api/v1/knowledge/status') return Response.json({ success: true, data: { version: knowledgeVersion } });
    return Response.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
  };
}
test('checks exact deployed commit and knowledge using only GET', async () => {
  const results = await smokeRelease({ commit, env, knowledgeVersion, fetcher: fixture() });
  assert.equal(results.length, 4);
  assert.ok(results.every(r => r.status === 'PASS'));
});
test('stale deployment and unavailable knowledge fail independently', async () => {
  const results = await smokeRelease({ commit, env, knowledgeVersion, fetcher: fixture({
    '/kareo-version.json': () => Response.json({ commit: 'b'.repeat(40) }),
    '/api/v1/knowledge/status': () => Response.json({ success: false, error: { code: 'KNOWLEDGE_UNAVAILABLE' } }, { status: 503 }),
  }) });
  assert.equal(results.filter(r => r.status === 'FAIL').length, 2);
});
test('HTML fallback cannot pass as JSON API 404', async () => {
  const results = await smokeRelease({ commit, env, knowledgeVersion, fetcher: fixture({
    '/api/v1/j004-nonexistent-route': () => new Response('<html/>', { status: 404 }),
  }) });
  assert.equal(results.at(-1).status, 'FAIL');
});
