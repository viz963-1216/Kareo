import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createHandler, SOURCES, PROJECT_URL, REGION, MAX_BYTES } from '../supabase/functions/crawler-official-source/handler.mjs';

const syntheticKey = 'synthetic-server-only-key';
const env = { SUPABASE_URL: PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY: syntheticKey, SB_REGION: REGION };
const request = (body = { sourceId: 'SRC-NTPC-CAREYOU-BRANCH' }, overrides = {}) => new Request(`${PROJECT_URL}/functions/v1/crawler-official-source`, {
  method: 'POST', headers: { Authorization: `Bearer ${syntheticKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body), ...overrides,
});
const goodHtml = '<html><title>新北市政府</title>長照服務管理中心 民眾交通使用須知</html>';

test('returns actual official bytes with hash; never forwards caller credential, URL or headers', async () => {
  for (const sourceId of Object.keys(SOURCES)) {
    let observed;
    const handle = createHandler({ getEnv: n => env[n], fetchImpl: async (url, options) => {
      observed = { url, options };
      return new Response(goodHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } });
    const r = await handle(request({ sourceId }));
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(observed.url, SOURCES[sourceId]);
    assert.equal(observed.options.redirect, 'error');
    assert.deepEqual(observed.options.headers, { Accept: 'text/html' });
    assert.ok(observed.options.signal instanceof AbortSignal);
    assert.equal(body.sourceUrl, SOURCES[sourceId]);
    assert.equal(body.region, REGION);
    assert.equal(Buffer.from(body.rawBase64, 'base64').toString(), goodHtml);
    assert.equal(body.byteLength, Buffer.byteLength(goodHtml));
    assert.equal(body.rawHash, 'sha256:' + createHash('sha256').update(goodHtml).digest('hex'));
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.ok(!JSON.stringify(body).includes(syntheticKey));
  }
});

test('rejects anonymous, anon-key, missing server credential, wrong project and wrong region before outbound request', async () => {
  for (const change of [{}, { SUPABASE_SERVICE_ROLE_KEY: '' }, { SUPABASE_URL: 'https://other.supabase.co' }, { SB_REGION: 'us-east-1' }]) {
    const handle = createHandler({ getEnv: n => ({ ...env, ...change })[n], fetchImpl: () => { throw Error('must not fetch'); } });
    const r = await handle(request(undefined, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon-key' } }));
    assert.ok([401, 503].includes(r.status));
  }
  const handle = createHandler({ getEnv: n => env[n], fetchImpl: () => { throw Error('must not fetch'); } });
  assert.equal((await handle(request(undefined, { headers: { 'Content-Type': 'application/json' } }))).status, 401);
});

test('rejects URL injection, prototype keys, extra fields, arrays and oversized requests without fetch', async () => {
  const handle = createHandler({ getEnv: n => env[n], fetchImpl: () => { throw Error('must not fetch'); } });
  for (const body of [null, [], { sourceId: '__proto__' }, { sourceId: 'https://internal/' },
    { sourceId: 'SRC-NTPC-CAREYOU-BRANCH', url: 'http://localhost' }, { sourceId: 'x'.repeat(1024) }]) {
    assert.equal((await handle(request(body))).status, 400);
  }
});

test('managed default secret-key fast path; invalid, publishable and user credentials are denied', async () => {
  const backendKey = 'sb_secret_synthetic_backend_only';
  const keys = JSON.stringify({ default: backendKey });
  const handle = createHandler({ getEnv: n => ({ ...env, SUPABASE_SECRET_KEYS: keys })[n], authFetch: async () => new Response(null, { status: 401 }),
    fetchImpl: async () => new Response(goodHtml, { headers: { 'content-type': 'text/html' } }) });
  const r = await handle(request(undefined, { headers: { apikey: backendKey, 'Content-Type': 'application/json' } }));
  assert.equal(r.status, 200);
  for (const bad of ['sb_publishable_synthetic', 'user.jwt.token', 'sb_secret_wrong_key']) {
    assert.equal((await handle(request(undefined, { headers: { apikey: bad, 'Content-Type': 'application/json' } }))).status, 401);
  }
  const closed = createHandler({ getEnv: n => ({ ...env, SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEYS: '{bad' })[n] });
  assert.equal((await closed(request())).status, 401);
});

test('rotated server keys need own-project zero-record HEAD authorization; forged claims and foreign/user roles fail', async () => {
  const claims = { role: 'service_role', ref: 'ojawadobnaxduxybqolk' };
  const rotated = `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic-signature`;
  let authCall, officialOptions;
  const setup = (status) => createHandler({ getEnv: n => env[n], authFetch: async (url, options) => {
    authCall = { url, options }; return new Response(null, { status });
  }, fetchImpl: async (_, options) => { officialOptions = options; return new Response(goodHtml, { headers: { 'content-type': 'text/html' } }); } });
  const input = () => request(undefined, { headers: { Authorization: `Bearer ${rotated}`, 'Content-Type': 'application/json' } });
  assert.equal((await setup(200)(input())).status, 200);
  assert.equal(authCall.url, PROJECT_URL + '/rest/v1/internal_operators?select=id&limit=0');
  assert.equal(authCall.options.method, 'HEAD');
  assert.deepEqual(officialOptions.headers, { Accept: 'text/html' });
  for (const status of [401, 403, 500]) assert.equal((await setup(status)(input())).status, 401);
  for (const badClaims of [{ ...claims, role: 'authenticated' }, { ...claims, ref: 'foreign-project' }]) {
    const bad = `h.${Buffer.from(JSON.stringify(badClaims)).toString('base64url')}.s`;
    const handle = createHandler({ getEnv: n => env[n], authFetch: () => { throw Error('must not authorize foreign/user key'); } });
    assert.equal((await handle(request(undefined, { headers: { Authorization: `Bearer ${bad}`, 'Content-Type': 'application/json' } }))).status, 401);
  }
});

test('fails closed on redirects, non-HTML, challenge pages, empty/oversized bodies and upstream errors', async () => {
  const replies = [
    () => new Response('', { status: 302, headers: { location: 'https://elsewhere/' } }),
    () => new Response(goodHtml, { headers: { 'content-type': 'application/json' } }),
    () => new Response('<html>Login or CAPTCHA required</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('', { headers: { 'content-type': 'text/html' } }),
    () => new Response('x'.repeat(MAX_BYTES + 1), { headers: { 'content-type': 'text/html' } }),
    () => { throw Error(`upstream exception contains ${syntheticKey}`); },
    () => { throw new DOMException('upstream deadline', 'TimeoutError'); },
    () => { throw new DOMException('upstream aborted', 'AbortError'); },
  ];
  for (const reply of replies) {
    const handle = createHandler({ getEnv: n => env[n], fetchImpl: async () => reply() });
    const r = await handle(request());
    assert.equal(r.status, 502);
    const body = await r.json();
    assert.ok(!JSON.stringify(body).includes(syntheticKey));
    if (replies.indexOf(reply) >= 6) assert.equal(body.error, 'OFFICIAL_SOURCE_TIMEOUT');
  }
});
