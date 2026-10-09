import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createRegionalCrawlerFetcher } from '../src/services/regionalCrawlerFetcher.js';

const url = 'https://www.careyou.ntpc.gov.tw/w/agecare/care-branch';
const env = { SUPABASE_URL: 'https://ojawadobnaxduxybqolk.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-secret' };
const at = Date.parse('2026-10-09T08:00:00Z');
const html = '<html>長照服務管理中心</html>', raw = Buffer.from(html);
const good = () => ({ sourceId: 'SRC-NTPC-CAREYOU-BRANCH', sourceUrl: url, region: 'ap-northeast-1',
  fetchedAt: new Date(at).toISOString(), contentType: 'text/html; charset=utf-8', byteLength: raw.length,
  rawBase64: raw.toString('base64'), rawHash: 'sha256:' + createHash('sha256').update(raw).digest('hex') });
const reply = (body: unknown, region = 'ap-northeast-1') => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', 'x-sb-edge-region': region },
});

describe('server-only regional crawler transport', () => {
  it('preserves raw bytes and provenance and sends existing credentials only to the fixed own-project endpoint', async () => {
    let observed: { url: unknown; options: RequestInit | undefined } | undefined;
    const fetcher = createRegionalCrawlerFetcher({ env, now: () => at, fetchImpl: async (u, options) => {
      observed = { url: u, options }; return reply(good());
    } });
    const r = await fetcher(url);
    expect(r.ok).toBe(true); expect(Buffer.from(r.rawBytes!)).toEqual(raw); expect(r.text).toBe(html);
    expect(observed!.url).toBe(env.SUPABASE_URL + '/functions/v1/crawler-official-source');
    expect(observed!.options!.redirect).toBe('error');
    expect(observed!.options!.headers).toEqual({ Authorization: 'Bearer synthetic-server-secret',
      'Content-Type': 'application/json', 'x-region': 'ap-northeast-1' });
    expect(JSON.parse(observed!.options!.body as string)).toEqual({ sourceId: 'SRC-NTPC-CAREYOU-BRANCH' });
  });
  it('uses apikey for new secret keys, without a bearer header', async () => {
    const fetcher = createRegionalCrawlerFetcher({ env: { ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic' },
      now: () => at, fetchImpl: async (_, options) => {
        expect(options!.headers).toEqual({ apikey: 'sb_secret_synthetic', 'Content-Type': 'application/json', 'x-region': 'ap-northeast-1' });
        return reply(good());
      } });
    expect((await fetcher(url)).ok).toBe(true);
  });
  it('leaves all other official sources with the existing direct fetcher', async () => {
    let directUrl;
    const fetcher = createRegionalCrawlerFetcher({ env, fetchImpl: async () => { throw Error('must not use regional transport'); },
      direct: async u => { directUrl = u; return { ok: true, text: 'direct', errorMessage: null }; } });
    expect((await fetcher('https://law.moj.gov.tw/')).text).toBe('direct');
    expect(directUrl).toBe('https://law.moj.gov.tw/');
  });
  it('rejects replaced bytes, provenance, stale snapshots, redirects and incorrect execution region', async () => {
    for (const patch of [{ rawHash: 'sha256:' + '0'.repeat(64) }, { rawBase64: raw.toString('base64') + '\n' },
      { sourceUrl: 'https://elsewhere/' }, { sourceId: 'SRC-OTHER' }, { region: 'us-east-1' },
      { fetchedAt: new Date(at - 61000).toISOString() }, { fetchedAt: 'invalid' }, { byteLength: raw.length + 1 }]) {
      const fetcher = createRegionalCrawlerFetcher({ env, now: () => at, fetchImpl: async () => reply({ ...good(), ...patch }) });
      expect((await fetcher(url)).ok).toBe(false);
    }
    const wrongRegion = createRegionalCrawlerFetcher({ env, fetchImpl: async () => reply(good(), 'us-east-1') });
    expect((await wrongRegion(url)).ok).toBe(false);
    const redirected = createRegionalCrawlerFetcher({ env, fetchImpl: async () => new Response('', { status: 302 }) });
    expect((await redirected(url)).ok).toBe(false);
  });
  it('rejects missing configuration and sanitizes network exceptions', async () => {
    expect(() => createRegionalCrawlerFetcher({ env: {} })).toThrow('REGIONAL_CRAWLER_CONFIG_INVALID');
    expect(() => createRegionalCrawlerFetcher({ env: { ...env, SUPABASE_URL: 'https://other.supabase.co' } })).toThrow('REGIONAL_CRAWLER_CONFIG_INVALID');
    const fetcher = createRegionalCrawlerFetcher({ env, fetchImpl: async () => { throw Error(env.SUPABASE_SERVICE_ROLE_KEY); } });
    const failed = await fetcher(url);
    expect(failed.errorMessage).toBe('REGIONAL_SOURCE_FETCH_FAILED');
    expect(JSON.stringify(failed)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
  });
});
