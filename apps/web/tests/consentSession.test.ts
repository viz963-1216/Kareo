import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { startConsentedSession } from '../src/consent/startSession.ts';

test('actual compiled API refuses unknown/text mismatch before Session and submits exactly the displayed versions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kareo-web-consent-api-'));
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  } });
  const body = 'Synthetic exact consent bytes. 合成測試。\n';
  const versions = { disclaimerVersion: 'D', privacyVersion: 'P', termsVersion: 'T' };
  const archive = { version: '2099-01-01-r1', ...versions, active: true, fullTextUrl: '/privacy/versions/2099-01-01-r1.txt',
    assessmentConsentText: '合成測試同意。', fullTextSha256: createHash('sha256').update(body).digest('hex') };
  try {
    for (const scenario of ['unknown', 'changed', 'changed-after-reading', 'valid']) {
      const outfile = join(directory, `${scenario}.mjs`);
      await build({ entryPoints: [fileURLToPath(new URL('../src/api/index.ts', import.meta.url))], outfile,
        bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', minifySyntax: true,
        define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_KAREO_API_MODE: 'real',
          VITE_KAREO_REQUIRE_SESSION_TOKEN: 'true', VITE_CONSENT_DISCLAIMER_VERSION: 'D',
          VITE_CONSENT_PRIVACY_VERSION: 'P', VITE_CONSENT_TERMS_VERSION: 'T' }),
          __KAREO_CONSENT_DOCUMENTS__: JSON.stringify({ schemaVersion: 1, archives: scenario === 'unknown' ? [] : [archive] }) } });
      const calls: Array<{ path: string; body?: unknown }> = [];
      let changeAfterReading = false;
      globalThis.fetch = async (input, init) => {
        const path = String(input); calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (path === archive.fullTextUrl) return new Response(scenario === 'changed' || changeAfterReading ? body + 'changed' : body, { headers: { 'Content-Type': 'text/plain' } });
        const data = path.endsWith('/session') ? { sessionId: 'SES-SYNTHETIC', sessionToken: 'SYNTHETIC-ONLY-TOKEN', createdAt: '2099-01-01T00:00:00Z' }
          : { consentId: 'CON-SYNTHETIC', acceptedAt: '2099-01-01T00:00:00Z' };
        return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
      };
      const { api, consentIsDraft, getConsentDocument } = await import(pathToFileURL(outfile).href);
      if (scenario === 'changed-after-reading') { await getConsentDocument(); changeAfterReading = true; }
      if (scenario !== 'valid') {
        await assert.rejects(startConsentedSession(api), (error: { code?: string }) => error.code === 'CONSENT_VERSION_UNAVAILABLE');
        assert.ok(calls.every(call => !call.path.startsWith('/api/')));
        if (scenario === 'unknown') { assert.equal(consentIsDraft, true); assert.equal(calls.length, 0); }
      } else {
        const created = await startConsentedSession(api); assert.equal(created.sessionId, 'SES-SYNTHETIC');
        assert.deepEqual(calls.map(call => call.path), [archive.fullTextUrl, '/api/v1/session', '/api/v1/consent']);
        assert.deepEqual(calls[2].body, { sessionId: 'SES-SYNTHETIC', ...versions, accepted: true });
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await rm(directory, { recursive: true, force: true });
  }
});
