// J-003 integration checks (no dependencies). Exit 1 on any FAIL; PENDING items are reported, never counted as PASS.
//  1. netlify.toml API redirects <-> apps/api/src/functions files
//  2. catch-all /api/* after every specific route
//  3. contracts/mock/*.json envelope and forbidden official-eligibility fields
//  4. forbidden fields absent from frontend/backend source
//  5. API_CONTRACT endpoints vs deployed routes (implemented / pending report)
import { existsSync, readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const results = [];
const record = (status, check, detail) => results.push({ status, check, detail });

// 1-2. Netlify routes
const toml = readFileSync('netlify.toml', 'utf8');
const redirects = [...toml.matchAll(/\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"/g)].map((m) => ({ from: m[1], to: m[2] }));
const functionDir = 'apps/api/src/functions';
const functionFiles = readdirSync(functionDir).filter((f) => f.endsWith('.ts')).map((f) => basename(f, '.ts'));
const routed = new Map();
for (const r of redirects) {
  const m = r.to.match(/^\/\.netlify\/functions\/([A-Za-z0-9_-]+)$/);
  if (!m) continue;
  routed.set(r.from, m[1]);
  if (!functionFiles.includes(m[1])) record('FAIL', 'route target exists', `${r.from} -> ${m[1]} has no ${functionDir}/${m[1]}.ts`);
}
for (const fn of functionFiles) {
  if (![...routed.values()].includes(fn)) record('FAIL', 'function is routed', `${fn}.ts has no /api/v1 redirect (it would be unreachable behind the /api/* 404 catch-all)`);
}
const catchAll = redirects.findIndex((r) => r.from === '/api/*');
if (catchAll === -1) record('FAIL', 'api catch-all', 'missing /api/* JSON 404 redirect');
redirects.forEach((r, i) => { if (r.from.startsWith('/api/v1/') && catchAll !== -1 && i > catchAll) record('FAIL', 'route order', `${r.from} is after /api/* catch-all`); });
if (!results.some((r) => r.status === 'FAIL')) record('PASS', 'netlify routes', `${routed.size} API routes map to ${functionFiles.length} functions`);

// 3. Mock contracts
const FORBIDDEN = ['officialCMSLevel', 'officialEligibility', 'approvedBenefit'];
const mockDir = 'contracts/mock';
let mockFails = 0;
for (const file of readdirSync(mockDir).filter((f) => f.endsWith('.json'))) {
  const text = readFileSync(join(mockDir, file), 'utf8');
  let json;
  try { json = JSON.parse(text); } catch (e) { record('FAIL', 'mock JSON', `${file}: ${e.message}`); mockFails++; continue; }
  if (json.success !== true || typeof json.data !== 'object' || json.data === null) { record('FAIL', 'mock envelope', `${file}: must be {success:true,data:{}}`); mockFails++; }
  for (const key of FORBIDDEN) if (text.includes(`"${key}"`)) { record('FAIL', 'forbidden field', `${file} contains ${key}`); mockFails++; }
  if (file === 'assessment-response.json' && !(json.data?.careNeedProfile?.warnings?.length > 0)) { record('FAIL', 'assessment warnings', 'assessment mock must include warnings'); mockFails++; }
  if (file === 'recommendation-response.json' && (json.data?.providers?.length ?? 0) > 3) { record('FAIL', 'top 3', 'recommendation mock returns more than 3 providers'); mockFails++; }
}
if (!mockFails) record('PASS', 'mock contracts', 'envelopes valid, no forbidden fields');

// 4. Forbidden fields in source
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
let srcFails = 0;
for (const file of [...walk('apps/web/src'), ...walk('apps/api/src')]) {
  // Comments may name the forbidden fields to document the rule; only code is checked.
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const key of FORBIDDEN) if (text.includes(key)) { record('FAIL', 'forbidden field in source', `${file} references ${key}`); srcFails++; }
}
if (!srcFails) record('PASS', 'source forbidden fields', 'none found');

// 5. Contract endpoints vs routes
const contract = readFileSync('docs/API_CONTRACT.md', 'utf8');
const endpoints = [...new Set([...contract.matchAll(/^## (GET|POST|DELETE|PUT|PATCH) (\/api\/v1\/[^\s（(]+)/gm)].map((m) => `${m[1]} ${m[2]}`))];
for (const ep of endpoints) {
  const path = ep.split(' ')[1].replace(/\{[^}]+\}/g, '*');
  const match = [...routed.keys()].some((from) => from === path || (from.endsWith('*') && path.startsWith(from.slice(0, -1))) || from.replace(/:[^/]+/g, '*') === path);
  record(match ? 'PASS' : 'PENDING', 'contract endpoint deployed', `${ep}${match ? '' : ' — no route/function yet'}`);
}

const pad = (s, n) => String(s).padEnd(n);
for (const r of results) console.log(`${pad(r.status, 8)} ${pad(r.check, 28)} ${r.detail}`);
const fails = results.filter((r) => r.status === 'FAIL').length;
const pending = results.filter((r) => r.status === 'PENDING').length;
console.log(`\nSummary: ${results.length - fails - pending} PASS, ${pending} PENDING, ${fails} FAIL`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Integration checks\n\n| Status | Check | Detail |\n|---|---|---|\n${results.map((r) => `| ${r.status} | ${r.check} | ${r.detail.replace(/\|/g, '\\|')} |`).join('\n')}\n\n`);
}
process.exit(fails ? 1 : 0);
