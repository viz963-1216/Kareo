// Disposable local integration environment. Actual Functions, supabase-js, PostgREST and PG17.
// Never changes cloud credentials, production consent files, or deployed acceptance evidence.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { parseRedirects, firstRedirect, functionName } from '../../scripts/lib/netlify-routes.mjs';
import { publishConsentProposals } from '../../scripts/lib/consent-proposal-archive.mjs';

export const TEST_CONSENT = { disclaimerVersion: 'LOCAL-TEST-2026-10-05', privacyVersion: 'LOCAL-TEST-2026-10-05', termsVersion: 'LOCAL-TEST-2026-10-05' };
export const LOCAL_OPERATOR = 'LOCAL-SYNTHETIC-OPERATOR';
const root = fileURLToPath(new URL('../..', import.meta.url));
const apiRequire = createRequire(join(root, 'apps/api/package.json'));
const dbRequire = createRequire(join(root, 'tests/db/package.json'));

export function localDatabaseUrl(raw, disposable) {
  const url = new URL(raw);
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !url.port
    || url.search || url.hash || url.pathname !== '/kareo_local_integration_test'
    || url.username !== 'kareo_test' || disposable !== '1') throw new Error('Disposable loopback integration database required');
  return url;
}

async function freePort() {
  const probe = createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  return port;
}

function childRun(file, args, env, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(file, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', b => { output += b; });
    child.stderr.on('data', b => { output += b; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveRun(output) : reject(new Error(`Local ${args[0]?.split('/').pop()} failed: ${output.slice(-2000)}`)));
  });
}

export async function startLocalStack({ databaseUrl, postgrestBinary, disposable = process.env.KAREO_LOCAL_DISPOSABLE, frontend = true } = {}) {
  const dbUrl = localDatabaseUrl(databaseUrl, disposable);
  assert.ok(existsSync(postgrestBinary), 'Explicit PostgREST executable required');
  const { Client } = dbRequire('pg');
  const db = new Client({ connectionString: dbUrl.href, statement_timeout: 15000 });
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'kareo-local-stack-')));
  const handlers = new Map();
  let gateway, postgrest, stopped = false;
  const savedEnv = Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(k => [k, process.env[k]]));
  const close = async () => {
    if (stopped) return; stopped = true;
    if (gateway) { gateway.closeAllConnections(); await new Promise(r => gateway.close(r)); }
    if (postgrest && postgrest.exitCode === null && postgrest.signalCode === null) {
      const ended = new Promise(r => postgrest.once('exit', r)); postgrest.kill('SIGTERM'); await ended;
    }
    await db.end();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(temp, { recursive: true, force: true });
  };
  try {
    await db.connect();
    const identity = (await db.query("select current_database() db, current_user usr, current_setting('server_version_num')::int version")).rows[0];
    assert.equal(identity.db, 'kareo_local_integration_test'); assert.equal(identity.usr, 'kareo_test');
    assert.ok(identity.version >= 170000 && identity.version < 180000, 'PG17 required');
    assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n, 0, 'Refuse a nonempty database; never drop existing tables');
    await db.query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
    const migrations = readdirSync(join(root, 'apps/api/supabase/migrations')).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
    for (const f of migrations) await db.query(readFileSync(join(root, 'apps/api/supabase/migrations', f), 'utf8'));
    // Fixture preparation: official registry metadata, not fabricated sources or approvals.
    for (const line of readFileSync(join(root, 'docs/knowledge/source-registry.md'), 'utf8').split(/\r?\n/)) {
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const id = cells[0]?.match(/^`(SRC-[A-Z0-9-]+)`$/)?.[1];
      if (!id || cells.length < 8) continue;
      await db.query(`insert into knowledge_sources(id,name,authority,jurisdiction,source_url,active,created_at,updated_at) values($1,$2,$3,$4,$5,$6,now(),now())`, [id, cells[1], cells[2].replace(/`/g,''), cells[3].replace(/`/g,''), cells[4], cells[7].toLowerCase() === 'true']);
    }
    const password = randomBytes(32).toString('hex');
    await db.query(`create role kareo_local_authenticator login noinherit password '${password}'; grant anon, authenticated, service_role to kareo_local_authenticator;`);
    const authUrl = new URL(dbUrl); authUrl.username = 'kareo_local_authenticator'; authUrl.password = password;
    const secret = randomBytes(48).toString('hex');
    const jwt = role => {
      const body = [ { alg: 'HS256', typ: 'JWT' }, { role, exp: Math.floor(Date.now()/1000) + 86400 } ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
      return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
    };
    const restPort = await freePort();
    let restOutput = '';
    postgrest = spawn(postgrestBinary, [], { env: { ...process.env,
      PGRST_DB_URI: authUrl.href, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(restPort), PGRST_DB_CONFIG: 'false', PGRST_LOG_LEVEL: 'crit' }, stdio: ['ignore', 'pipe', 'pipe'] });
    postgrest.stdout.on('data', b => { restOutput += b; }); postgrest.stderr.on('data', b => { restOutput += b; });
    let restError; postgrest.on('error', e => { restError = e; });
    const restBase = `http://127.0.0.1:${restPort}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (restError) throw restError;
      if (postgrest.exitCode !== null || postgrest.signalCode !== null) throw new Error(`Local PostgREST exited: ${restOutput.slice(-1000)}`);
      try { const r = await fetch(restBase + '/providers?select=id&limit=1', { headers: { Authorization: `Bearer ${jwt('service_role')}` }, signal: AbortSignal.timeout(1000) }); if (r.ok) { ready = true; break; } } catch {}
      await delay(100);
    }
    assert.ok(ready, 'PostgREST schema not ready');
    const routes = parseRedirects(readFileSync(join(root, 'netlify.toml'), 'utf8'));
    const esbuild = apiRequire('esbuild');
    const consentPlugin = { name: 'local-test-consent-only', setup(build) {
      build.onLoad({ filter: /consent-versions\.json$/ }, ({ path }) => {
        assert.equal(resolve(path), join(root, 'contracts/legal/consent-versions.json'));
        const original = JSON.parse(readFileSync(path, 'utf8'));
        return { contents: JSON.stringify({ ...original, versions: [...original.versions, { ...TEST_CONSENT, status: 'ACTIVE' }] }), loader: 'json' };
      });
    } };
    for (const fn of new Set(routes.map(functionName).filter(Boolean))) {
      const output = join(temp, `${fn}.cjs`);
      await esbuild.build({ entryPoints: [join(root, 'apps/api/src/functions', fn + '.ts')], outfile: output, bundle: true, platform: 'node', target: 'node22', format: 'cjs', logLevel: 'silent', plugins: [consentPlugin] });
      handlers.set(fn, (await import(pathToFileURL(output).href)).handler);
    }
    const staticRoot = join(temp, 'web');
    gateway = createServer(async (req, res) => {
      const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname.startsWith('/rest/v1/')) {
          const body = []; for await (const b of req) body.push(b);
          const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers['content-length'];
          const response = await fetch(restBase + url.pathname.slice('/rest/v1'.length) + url.search, { method: req.method, headers, body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(body), signal: AbortSignal.timeout(15000) });
          res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
        }
        if (url.pathname.startsWith('/api/')) {
          const fn = functionName(firstRedirect(routes, url.pathname));
          if (!fn) return send(404, { success: false, error: { code: 'NOT_FOUND', message: '此 API 尚未提供。' } });
          const body = []; let size = 0;
          for await (const b of req) { size += b.length; if (size > 65536) return send(413, { success: false, error: { code: 'INVALID_REQUEST', message: '請求過大。' } }); body.push(b); }
          const event = { httpMethod: req.method, path: url.pathname, rawUrl: `http://${req.headers.host}${req.url}`, queryStringParameters: Object.fromEntries(url.searchParams), headers: { ...req.headers, 'x-nf-client-connection-ip': '127.0.0.1' }, body: body.length ? Buffer.concat(body).toString('utf8') : null };
          const response = await handlers.get(fn)(event, {});
          res.writeHead(response.statusCode, response.headers); res.end(response.body); return;
        }
        const asset = resolve(staticRoot, '.' + decodeURIComponent(url.pathname));
        if (asset !== staticRoot && !asset.startsWith(staticRoot + sep)) return send(404, { error: 'NOT_FOUND' });
        const path = existsSync(asset) && extname(asset) ? asset : join(staticRoot, 'index.html');
        if (!existsSync(path)) return send(404, { error: 'Frontend not built' });
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
        const raw = readFileSync(path);
        res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(extname(path) === '.html' ? raw.toString().replace('<body>', '<body><div style="padding:8px;background:#fff3cd;text-align:center">本機隔離測試・合成資料・測試同意版本，非正式上線</div>') : raw);
      } catch { send(500, { success: false, error: { code: 'INTERNAL_ERROR', message: '本機整合環境發生錯誤。' } }); }
    });
    await new Promise(r => gateway.listen(0, '127.0.0.1', r));
    const baseUrl = `http://127.0.0.1:${gateway.address().port}`;
    const operatorKey = randomBytes(32).toString('hex');
    await db.query(`insert into internal_operators(id,display_name,roles,key_hash,active,created_at) values($1,'Local synthetic operator',array['KNOWLEDGE_PUBLISHER','LEAD_OPERATOR','DATA_STEWARD'],$2,true,now())`, [LOCAL_OPERATOR, createHash('sha256').update(operatorKey).digest('hex')]);
    process.env.SUPABASE_URL = baseUrl; process.env.SUPABASE_SERVICE_ROLE_KEY = jwt('service_role');
    const localEnv = { ...process.env, SUPABASE_URL: baseUrl, SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'), KAREO_OPERATOR_ID: LOCAL_OPERATOR, KAREO_OPERATOR_KEY: operatorKey };
    const cli = async (name, args, overrides = {}) => {
      const output = join(temp, `${name}.mjs`);
      await esbuild.build({ entryPoints: [join(root, 'apps/api/src/scripts', name + '.ts')], outfile: output, bundle: true, platform: 'node', target: 'node22', format: 'esm', logLevel: 'silent', banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } });
      return childRun(process.execPath, [output, ...args], { ...localEnv, ...overrides });
    };
    await cli('importProviderDataset', ['--commit', join(root, 'data/providers/staging')]);
    const packs = readdirSync(join(root, 'contracts/knowledge/packs')).filter(f => f.endsWith('.json')).sort().map(f => join(root, 'contracts/knowledge/packs', f));
    for (const pack of packs) {
      const imported = await cli('importKnowledgePack', ['--commit', '--operator-id', LOCAL_OPERATOR, pack, join(root, 'docs/knowledge/source-registry.md')]);
      assert.ok(imported.includes('Result: DATA WRITTEN'), `Protected import did not execute: ${imported}`);
      await cli('approveKnowledgePack', [pack]);
    }
    await cli('publishKnowledgeVersion', [LOCAL_OPERATOR, 'Existing approved pack reviewers (local rehearsal)', '--', ...packs]);
    if (frontend) {
      await childRun(process.execPath, [join(root, 'apps/web/node_modules/vite/bin/vite.js'), 'build', '--outDir', staticRoot, '--emptyOutDir'], {
        ...process.env, VITE_KAREO_API_MODE: 'real', VITE_KAREO_DEPLOY_CONTEXT: 'local', VITE_KAREO_REQUIRE_SESSION_TOKEN: 'true', VITE_KAREO_ENABLE_PRECISE_LOCATION: 'true',
        VITE_CONSENT_DISCLAIMER_VERSION: TEST_CONSENT.disclaimerVersion, VITE_CONSENT_PRIVACY_VERSION: TEST_CONSENT.privacyVersion, VITE_CONSENT_TERMS_VERSION: TEST_CONSENT.termsVersion,
      }, join(root, 'apps/web'));
      // This disposable build calls Vite directly, so npm's prebuild hook does
      // not run. Generate its archive explicitly from canonical source bytes.
      await publishConsentProposals(root, staticRoot);
    }
    const prepareAdminFixture = async () => {
      const pack = JSON.parse(readFileSync(packs[0], 'utf8'));
      const review = { reviewedBy: LOCAL_OPERATOR, reviewedAt: new Date().toISOString(), decision: 'APPROVED' };
      pack.packId = 'KP-2026-10-05-900'; pack.intendedKnowledgeVersion = 'KB-2026-10-05-900'; pack.createdBy = LOCAL_OPERATOR; pack.review = review;
      pack.records = [0,1,2].map(i => ({ ...structuredClone(pack.records[0]), recordId: `KR-2026-${900+i}`,
        title: `本機虛構管理端測試 ${i}`, summary: '本機虛構知識，不可用於正式政策。', excerpt: '本機虛構內容。', ruleData: {}, review }));
      const path = join(temp, 'synthetic-admin-pack.json'); writeFileSync(path, JSON.stringify(pack));
      await cli('importKnowledgePack', ['--commit', '--operator-id', LOCAL_OPERATOR, path, join(root, 'docs/knowledge/source-registry.md')]);
    };
    return { baseUrl, db, cli, close, operatorKey, jwt, migrations, prepareAdminFixture, backend: 'PostgreSQL 17 + official PostgREST + supabase-js + bundled Functions', frontendBuilt: frontend };
  } catch (e) { await close(); throw e; }
}
