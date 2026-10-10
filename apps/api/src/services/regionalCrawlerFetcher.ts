import { createHash } from 'node:crypto';
import { createHttpFetcher, type Fetcher } from './crawlerService.js';

const PROJECT = 'https://ojawadobnaxduxybqolk.supabase.co';
const ENDPOINT = `${PROJECT}/functions/v1/crawler-official-source`;
const REGION = 'ap-northeast-1';
const MAX_BYTES = 2 * 1024 * 1024;
const SOURCES: Readonly<Record<string, string>> = Object.freeze({
  'SRC-NTPC-CAREYOU-BRANCH': 'https://www.careyou.ntpc.gov.tw/w/agecare/care-branch',
  'SRC-NTPC-CAREYOU-LTCTS': 'https://www.careyou.ntpc.gov.tw/w/agecare/ltcts',
});

/** Server-side transport only. All other URLs retain the original HTTP fetcher. */
export function createRegionalCrawlerFetcher({
  env = process.env, fetchImpl = fetch, direct = createHttpFetcher(), now = () => Date.now(),
}: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; direct?: Fetcher; now?: () => number } = {}): Fetcher {
  if (env.SUPABASE_URL !== PROJECT || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('REGIONAL_CRAWLER_CONFIG_INVALID');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeaders: Record<string, string> = key.startsWith('sb_secret_')
    ? { apikey: key } : { Authorization: `Bearer ${key}` };
  return async (url) => {
    const sourceId = Object.keys(SOURCES).find(id => SOURCES[id] === url);
    if (!sourceId) return direct(url);
    const failed = (reason: string) => ({ ok: false, rawBytes: null, text: null, errorMessage: reason });
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { ...authHeaders, 'Content-Type': 'application/json', 'x-region': REGION },
        body: JSON.stringify({ sourceId }),
      });
      if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')
        || response.headers.get('x-sb-edge-region') !== REGION) {
        await response.body?.cancel();
        return failed('REGIONAL_SOURCE_UNAVAILABLE');
      }
      if (!response.body) return failed('REGIONAL_SOURCE_INVALID_RESPONSE');
      // Cap before parsing: base64 + metadata can be larger than the original HTML.
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES * 1.4 + 4096) { await reader.cancel(); return failed('REGIONAL_SOURCE_TOO_LARGE'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body.sourceId !== sourceId || body.sourceUrl !== url || body.region !== REGION
        || typeof body.rawBase64 !== 'string' || !Number.isInteger(body.byteLength) || body.byteLength <= 0
        || body.byteLength > MAX_BYTES || typeof body.contentType !== 'string'
        || !/^text\/html(?:;|$)/i.test(body.contentType) || !Number.isFinite(Date.parse(body.fetchedAt))
        || Math.abs(now() - Date.parse(body.fetchedAt)) > 60000) return failed('REGIONAL_SOURCE_INVALID_RESPONSE');
      const rawBytes = Buffer.from(body.rawBase64, 'base64');
      if (rawBytes.toString('base64') !== body.rawBase64 || rawBytes.length !== body.byteLength
        || `sha256:${createHash('sha256').update(rawBytes).digest('hex')}` !== body.rawHash) {
        return failed('REGIONAL_SOURCE_HASH_MISMATCH');
      }
      const text = new TextDecoder('utf8', { fatal: true }).decode(rawBytes);
      if (!/<html[\s>]/i.test(text) || !text.includes(sourceId.endsWith('BRANCH') ? '長照服務管理中心' : '民眾交通使用須知')) {
        return failed('REGIONAL_SOURCE_INVALID_CONTENT');
      }
      return { ok: true, rawBytes, text, contentType: body.contentType, errorMessage: null };
    } catch {
      // Neither credential nor raw upstream response/exception is included in a CrawlerRun.
      return failed('REGIONAL_SOURCE_FETCH_FAILED');
    }
  };
}
