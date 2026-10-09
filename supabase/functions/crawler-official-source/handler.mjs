// Server-only transport for the two unchanged approved careyou sources. Only a
// zero-record own-project HEAD may authorize a rotated server key; no business
// records, writes, caller URLs/headers/cookies, redirects, proxy or publication.
export const SOURCES = Object.freeze({
  'SRC-NTPC-CAREYOU-BRANCH': 'https://www.careyou.ntpc.gov.tw/w/agecare/care-branch',
  'SRC-NTPC-CAREYOU-LTCTS': 'https://www.careyou.ntpc.gov.tw/w/agecare/ltcts',
});
export const PROJECT_URL = 'https://ojawadobnaxduxybqolk.supabase.co';
export const REGION = 'ap-northeast-1';
export const MAX_BYTES = 2 * 1024 * 1024;

async function boundedBytes(stream, max) {
  if (!stream) throw new Error('EMPTY_BODY');
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error('BODY_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function equalSecret(actual, expected) {
  if (!expected || !actual || actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function createHandler({ getEnv, fetchImpl = fetch, authFetch = fetch, now = () => new Date() }) {
  const json = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  return async (request) => {
    if (getEnv('SUPABASE_URL') !== PROJECT_URL || getEnv('SB_REGION') !== REGION) {
      return json(503, { error: 'WRONG_EXECUTION_CONTEXT' });
    }
    // The gateway's JWT switch cannot authenticate new sb_secret_ keys. Authenticate
    // only a project-managed backend credential here; never accept an anon/user JWT.
    const legacy = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    let secret;
    try { secret = JSON.parse(getEnv('SUPABASE_SECRET_KEYS') || '{}').default; } catch { /* deny */ }
    const legacyAllowed = !!legacy && equalSecret(request.headers.get('Authorization'), `Bearer ${legacy}`);
    const secretAllowed = typeof secret === 'string' && secret.startsWith('sb_secret_')
      && equalSecret(request.headers.get('apikey'), secret);
    if (!legacyAllowed && !secretAllowed) {
      // A still-valid rotated server credential can differ from the Edge runtime's
      // built-in key. Ask the project's own REST authority, reading ZERO records.
      // The inspected ACL denies anon/authenticated SELECT on this internal table.
      const candidate = request.headers.get('apikey') || request.headers.get('Authorization')?.replace(/^Bearer /, '');
      let serverClaim = typeof candidate === 'string' && candidate.startsWith('sb_secret_');
      if (candidate && !serverClaim) {
        try {
          const claims = JSON.parse(atob(candidate.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          serverClaim = claims.ref === 'ojawadobnaxduxybqolk' && claims.role === 'service_role';
        } catch { /* not a server credential */ }
      }
      if (!candidate || !serverClaim) return json(401, { error: 'UNAUTHORIZED' });
      try {
        const headers = { apikey: candidate };
        if (!candidate.startsWith('sb_secret_')) headers.Authorization = `Bearer ${candidate}`;
        const authorized = await authFetch(`${PROJECT_URL}/rest/v1/internal_operators?select=id&limit=0`, {
          method: 'HEAD', headers, redirect: 'error', signal: AbortSignal.timeout(5000),
        });
        if (authorized.status !== 200) return json(401, { error: 'UNAUTHORIZED' });
      } catch { return json(401, { error: 'UNAUTHORIZED' }); }
    }
    if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
    if (new URL(request.url).search || request.headers.get('content-type') !== 'application/json') {
      return json(400, { error: 'INVALID_REQUEST' });
    }
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await boundedBytes(request.body, 512))); }
    catch { return json(400, { error: 'INVALID_REQUEST' }); }
    if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length !== 1
      || typeof body.sourceId !== 'string' || !Object.hasOwn(SOURCES, body.sourceId)) {
      return json(400, { error: 'INVALID_SOURCE' });
    }
    const sourceUrl = SOURCES[body.sourceId];
    try {
      const fetched = await fetchImpl(sourceUrl, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Accept: 'text/html' },
      });
      if (fetched.status !== 200 || (fetched.url && fetched.url !== sourceUrl)
        || !/^text\/html(?:;|$)/i.test(fetched.headers.get('content-type') || '')) {
        await fetched.body?.cancel().catch(() => {});
        return json(502, { error: 'OFFICIAL_SOURCE_INVALID_RESPONSE' });
      }
      const bytes = await boundedBytes(fetched.body, MAX_BYTES);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const required = body.sourceId.endsWith('BRANCH') ? '長照服務管理中心' : '民眾交通使用須知';
      if (!/<html[\s>]/i.test(text) || !text.includes(required)) {
        return json(502, { error: 'OFFICIAL_SOURCE_INVALID_CONTENT' });
      }
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return json(200, {
        sourceId: body.sourceId, sourceUrl, region: REGION, fetchedAt: now().toISOString(),
        contentType: fetched.headers.get('content-type'), byteLength: bytes.byteLength,
        rawHash: `sha256:${hash}`, rawBase64: btoa(binary),
      });
    } catch (error) {
      // Never emit raw exceptions: they may include internal URLs or auth headers.
      return json(502, { error: ['TimeoutError', 'AbortError'].includes(error?.name)
        ? 'OFFICIAL_SOURCE_TIMEOUT' : 'OFFICIAL_SOURCE_FETCH_FAILED' });
    }
  };
}
