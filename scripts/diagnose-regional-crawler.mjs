// Protected staging workflow: public-source reads only; no database/client writes.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const project = 'https://ojawadobnaxduxybqolk.supabase.co';
if (process.env.SUPABASE_URL !== project || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error('CONFIG_INVALID');
const endpoint = `${project}/functions/v1/crawler-official-source`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const auth = key.startsWith('sb_secret_') ? { apikey: key } : { Authorization: `Bearer ${key}` };
const result = { scope: 'PUBLIC_SOURCE_CONNECTIVITY_NOT_FULL_E2E', projectRef: 'ojawadobnaxduxybqolk',
  commit: process.env.GITHUB_SHA || null, startedAt: new Date().toISOString(), results: [] };
const anonymous = await fetch(endpoint, { method: 'POST', redirect: 'error',
  headers: { 'Content-Type': 'application/json', 'x-region': 'ap-northeast-1' },
  body: JSON.stringify({ sourceId: 'SRC-NTPC-CAREYOU-BRANCH' }), signal: AbortSignal.timeout(30000) });
result.anonymousStatus = anonymous.status; await anonymous.body?.cancel();
for (const sourceId of ['SRC-NTPC-CAREYOU-BRANCH', 'SRC-NTPC-CAREYOU-LTCTS']) {
  const r = await fetch(endpoint, { method: 'POST', redirect: 'error',
    headers: { ...auth, 'Content-Type': 'application/json', 'x-region': 'ap-northeast-1' },
    body: JSON.stringify({ sourceId }), signal: AbortSignal.timeout(30000) });
  const b = await r.json(); const raw = typeof b.rawBase64 === 'string' ? Buffer.from(b.rawBase64, 'base64') : null;
  const hashVerified = !!raw && raw.length === b.byteLength && b.rawHash === 'sha256:' + createHash('sha256').update(raw).digest('hex');
  result.results.push({ sourceId, httpStatus: r.status, actualRegion: r.headers.get('x-sb-edge-region'),
    reportedRegion: b.region || null, sourceUrl: b.sourceUrl || null, fetchedAt: b.fetchedAt || null,
    byteLength: raw?.length || 0, rawHash: b.rawHash || null, hashVerified,
    error: /^[A-Z_]+$/.test(b.error || '') ? b.error : null });
}
result.finishedAt = new Date().toISOString();
writeFileSync('regional-crawler-connectivity.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.anonymousStatus === 401 && result.results.every(r => r.httpStatus === 200
  && r.actualRegion === 'ap-northeast-1' && r.reportedRegion === 'ap-northeast-1' && r.hashVerified) ? 0 : 1;
