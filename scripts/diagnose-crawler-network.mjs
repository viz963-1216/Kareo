// Public official-source reads only; no credentials, proxies or TLS bypass.
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { execFileSync } from 'node:child_process';

const ids = new Set(['SRC-NTPC-CAREYOU-BRANCH', 'SRC-NTPC-CAREYOU-LTCTS', 'SRC-LAW-L0070059']);
console.log('DIAGNOSTIC PLATFORM', process.platform, process.arch);
const observations=[];
const rows = readFileSync(new URL('../docs/knowledge/source-registry.md', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => l.trim().startsWith('|'))
  .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
const sources = rows.filter(c => ids.has(c[0].replace(/`/g, '')) && c[7] === 'true');
if (sources.length !== ids.size) throw new Error('Approved diagnostic sources are missing or inactive');
for (const cells of sources) {
  const url = new URL(cells[4]);
  if (url.protocol !== 'https:' || !['www.careyou.ntpc.gov.tw','law.moj.gov.tw'].includes(url.hostname)) throw new Error('Unexpected source URL');
  const observation={sourceId:cells[0].replace(/`/g,''),nodeStatus:null,curlStatus:null};
  observations.push(observation);
  console.log(`SOURCE ${cells[0]} ${url.href}`);
  try { console.log('DNS', JSON.stringify(await lookup(url.hostname, { all: true }))); }
  catch (error) { console.log('DNS failed', error.code); }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    observation.nodeStatus=response.status;
    console.log('NODE', response.status, response.url);
    await response.body?.cancel();
  } catch (error) {
    // Log network causes, never environment/header/response contents.
    for (let cause = error, depth = 0; cause && depth < 4; cause = cause.cause, depth++) {
      console.log('NODE ERROR', cause.name, cause.code ?? '', cause.message);
      if (cause.errors) for (const e of cause.errors) console.log('CONNECT ERROR', e.code, e.address);
    }
  }
  try {
    const output = execFileSync('curl', ['--silent', '--show-error', '--location', '--max-time', '20',
      '--proto', '=https', '--proto-redir', '=https', '--output', '/dev/null', '--write-out',
      'CURL status=%{http_code} address=%{remote_ip} verify=%{ssl_verify_result}\n', url.href],
      { encoding: 'utf8', timeout: 25000 });
    observation.curlStatus=Number(output.match(/status=(\d+)/)?.[1]??0);
    console.log(output.trim());
  } catch (error) {
    console.log('CURL ERROR', error.status, String(error.stdout ?? '').trim(), String(error.stderr ?? '').trim());
  }
}
console.log('DIAGNOSTIC_RESULT '+JSON.stringify({platform:process.platform,observations,crawlerAcceptance:false}));
console.log('Read-only diagnostic finished; this is not a crawler or deployment acceptance run.');
