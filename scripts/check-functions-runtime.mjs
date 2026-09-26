// J-003 built-Functions check. TypeScript and Vitest do not prove that a Netlify Function works after
// bundling (JSON imports, import.meta, missing exports, top-level throws). This bundles every routed function
// with esbuild, as netlify.toml `node_bundler = "esbuild"` does, places it at its repo-relative path in an
// empty directory together with only the `[functions] included_files` (what Netlify ships), loads it in plain
// Node and calls the handler with no database credentials:
//   - the module loads and exports `handler`
//   - an HTTP method the contract does not define → JSON error envelope, 4xx
//   - the contract's method without credentials → JSON envelope; errors must not expose internals
// No network, no secrets. Needs `npm ci --prefix apps/api` (esbuild comes with the API toolchain);
// without it every item is PENDING. Exit 1 on any FAIL.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const results = [];
const record = (status, check, detail) => results.push({ status, check, detail });

const functionDir = 'apps/api/src/functions';
const toml = readFileSync('netlify.toml', 'utf8');
const routes = [...toml.matchAll(/\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "\/\.netlify\/functions\/([A-Za-z0-9_-]+)"/g)].map((m) => ({ from: m[1], fn: m[2] }));
const includedFiles = [...(toml.match(/^\s*included_files\s*=\s*\[([^\]]*)\]/m)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const contract = readFileSync('docs/API_CONTRACT.md', 'utf8');
const endpoints = [...contract.matchAll(/^## (GET|POST|DELETE|PUT|PATCH) (\/api\/v1\/[^\s（(]+)/gm)].map((m) => ({ method: m[1], path: m[2].replace(/\{[^}]+\}/g, '*') }));
const methodsFor = (from) => [...new Set(endpoints.filter((e) => e.path === from || (from.endsWith('*') && e.path.startsWith(from.slice(0, -1)))).map((e) => e.method))];

// Response text a user or attacker must never see (PRODUCT_SPEC §30, J-003 失敗畫面不暴露).
const LEAKS = [/\bat .+\.(ts|js):\d+/, /SUPABASE_/i, /service[_ ]?role/i, /postgres|PGRST|relation "|violates/i, /eyJ[A-Za-z0-9_-]{10,}/];

let esbuild;
try {
  esbuild = createRequire(resolve('apps/api/package.json'))('esbuild');
} catch {
  for (const { fn } of routes) record('PENDING', 'function bundle runs', `${fn}: esbuild not installed (run npm ci --prefix apps/api)`);
}

async function invoke(handler, event) {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const res = await Promise.race([handler(event, {}), new Promise((_, rej) => setTimeout(() => rej(new Error('handler timed out (10s)')), 10_000))]);
    let json = null;
    try { json = JSON.parse(res?.body ?? ''); } catch { /* not JSON */ }
    return { res, json };
  } finally {
    if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url;
    if (saved.key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  }
}
const isEnvelope = (j) => j && (j.success === true ? 'data' in j : j.success === false && typeof j.error?.code === 'string' && typeof j.error?.message === 'string');
const leak = (body) => LEAKS.find((re) => re.test(body ?? ''));

if (esbuild) {
  const out = mkdtempSync(join(tmpdir(), 'kareo-fn-'));
  for (const f of includedFiles) {
    if (/[*?]/.test(f)) { record('FAIL', 'included_files', `${f}: globs are not emulated by this check; list files explicitly`); continue; }
    if (!existsSync(f)) { record('FAIL', 'included_files', `${f} does not exist`); continue; }
    mkdirSync(dirname(join(out, f)), { recursive: true });
    cpSync(f, join(out, f));
  }
  try {
    for (const file of readdirSync(functionDir).filter((f) => f.endsWith('.ts'))) {
      const fn = basename(file, '.ts');
      const route = routes.find((r) => r.fn === fn);
      if (!route) continue; // check-integration.mjs already fails unrouted functions
      const outfile = join(out, functionDir, `${fn}.mjs`);
      try {
        await esbuild.build({ entryPoints: [join(functionDir, file)], outfile, bundle: true, platform: 'node', target: 'node22', format: 'esm', logLevel: 'silent',
          banner: { js: "import { createRequire as __kareoCreateRequire } from 'node:module'; const require = __kareoCreateRequire(import.meta.url);" } });
      } catch (e) { record('FAIL', 'function bundles', `${fn}: ${e.message.split('\n')[0]}`); continue; }
      let mod;
      try { mod = await import(pathToFileURL(outfile).href); } catch (e) { record('FAIL', 'function bundle loads', `${fn}: ${e.message}`); continue; }
      if (typeof mod.handler !== 'function') { record('FAIL', 'function exports handler', `${fn}: no handler export`); continue; }

      const methods = methodsFor(route.from);
      const path = route.from.replace('*', 'PROV-RUNTIME-CHECK');
      const event = (httpMethod) => ({ httpMethod, path, rawUrl: `https://example.invalid${path}`, headers: {}, queryStringParameters: {}, pathParameters: {}, body: httpMethod === 'GET' || httpMethod === 'DELETE' ? null : '{}' });

      const wrong = await invoke(mod.handler, event('PATCH')).catch((e) => ({ error: e }));
      if (wrong.error) record('FAIL', 'unsupported method', `${fn}: PATCH threw ${wrong.error.message}`);
      else if (!(wrong.res.statusCode >= 400 && wrong.res.statusCode < 500 && isEnvelope(wrong.json) && wrong.json.success === false)) record('FAIL', 'unsupported method', `${fn}: PATCH → ${wrong.res?.statusCode} ${String(wrong.res?.body).slice(0, 80)}`);
      else record('PASS', 'unsupported method', `${fn}: PATCH → ${wrong.res.statusCode} ${wrong.json.error.code}`);

      for (const m of methods) {
        const r = await invoke(mod.handler, event(m)).catch((e) => ({ error: e }));
        if (r.error) { record('FAIL', 'contract method runs', `${fn}: ${m} threw ${r.error.message}`); continue; }
        if (!isEnvelope(r.json)) { record('FAIL', 'contract method runs', `${fn}: ${m} → ${r.res?.statusCode} non-envelope body`); continue; }
        const bad = leak(r.res.body);
        // A contract method answered like an unsupported one: the function does not implement it yet.
        if (!r.json.success && r.json.error.code === 'INVALID_REQUEST' && r.json.error.message === wrong.json?.error?.message) record('PENDING', 'contract method runs', `${fn}: ${m} ${route.from} not implemented yet (same response as PATCH)`);
        else if (bad) record('FAIL', 'error body exposes internals', `${fn}: ${m} without DB credentials → ${r.res.statusCode} ${r.json.error?.code ?? ''} body matches ${bad}`);
        else record('PASS', 'contract method runs', `${fn}: ${m} (no DB credentials) → ${r.res.statusCode} ${r.json.success ? 'success' : r.json.error.code}`);
      }
      if (!methods.length) record('PENDING', 'contract method runs', `${fn}: route ${route.from} has no endpoint in API_CONTRACT`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const pad = (s, n) => String(s).padEnd(n);
for (const r of results) console.log(`${pad(r.status, 8)} ${pad(r.check, 28)} ${r.detail}`);
const fails = results.filter((r) => r.status === 'FAIL').length;
const pending = results.filter((r) => r.status === 'PENDING').length;
console.log(`\nSummary: ${results.length - fails - pending} PASS, ${pending} PENDING, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
