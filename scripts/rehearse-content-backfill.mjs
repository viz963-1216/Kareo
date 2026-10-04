// J-003 offline preparation from a private application snapshot. No cloud writes.
// Actual protected CLI + Supabase repositories/client + actual SQL RPCs, local shim only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { restoreApplicationSnapshot } from './restore-app-snapshot.mjs';
import { startPostgrestReadShim } from '../tests/db/postgrest-read-shim.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
let db, readShim, server;
try {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const match = arg.match(/^--(snapshot|output)=(.+)$/);
    if (!match) throw new Error('Invalid arguments');
    return [match[1], match[2]];
  }));
  if (!args.snapshot || !args.output) throw new Error('Missing snapshot or output');
  const raw = readFileSync(args.snapshot);
  const snapshot = JSON.parse(raw.toString());
  assert.equal(snapshot.projectRef, 'ojawadobnaxduxybqolk');
  const require = createRequire(join(root, 'tests/db/package.json'));
  const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
  db = new PGlite();
  const restored = await restoreApplicationSnapshot(db, snapshot, join(root, 'apps/api/supabase/migrations'));
  assert.equal(restored.status, 'PASS');
  const migrationsDir = join(root, 'apps/api/supabase/migrations');
  for (const file of readdirSync(migrationsDir).filter(f => /^\d{4}_.+\.sql$/.test(f) && f.slice(0, 4) > snapshot.schemaThrough).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  const operatorId = 'SYNTHETIC-LOCAL-BACKFILL';
  const operatorKey = randomBytes(32).toString('hex');
  await db.query(`insert into internal_operators(id,display_name,roles,key_hash,active,created_at)
    values($1,'Synthetic local rehearsal',array['KNOWLEDGE_PUBLISHER'],$2,true,now())`,
  [operatorId, createHash('sha256').update(operatorKey).digest('hex')]);
  const knowledgeState = async () => {
    const rows = {};
    for (const table of ['knowledge_records', 'knowledge_versions', 'knowledge_version_records']) {
      rows[table] = (await db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows;
    }
    return rows;
  };
  const original = await knowledgeState();
  readShim = await startPostgrestReadShim(db);
  let writes = 0;
  const RPCS = new Set(['upsert_content_pack', 'backfill_record_review_event']);
  server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && /^\/rest\/v1\/[a-z_]+$/.test(url.pathname)) {
        const response = await fetch(readShim.url + url.pathname + url.search, { headers: { accept: req.headers.accept ?? 'application/json' } });
        res.writeHead(response.status, { 'content-type': 'application/json' }); res.end(await response.text()); return;
      }
      const rpcName = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
      if (req.method !== 'POST' || !RPCS.has(rpcName)) return send(405, { code: 'LOCAL-SHIM', message: 'Unsupported local rehearsal request' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) return send(413, { code: 'LOCAL-SHIM', message: 'Oversized request' }); }
      const { payload } = JSON.parse(body);
      const value = (await db.query(`select public.${rpcName}($1::jsonb) result`, [JSON.stringify(payload)])).rows[0].result;
      writes++; send(200, value);
    } catch { send(500, { code: 'LOCAL-SHIM', message: 'Local RPC rehearsal failed' }); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-rehearsal-not-a-cloud-key';
  const [{ runBackfillCli }, { SupabaseKnowledgeRepository }, { SupabaseAdminKnowledgeRepository }] = await Promise.all([
    import('../apps/api/dist/scripts/backfillContentPacks.js'),
    import('../apps/api/dist/repositories/supabaseKnowledgeRepository.js'),
    import('../apps/api/dist/repositories/supabaseAdminKnowledgeRepository.js'),
  ]);
  const packsDir = join(root, 'contracts/knowledge/packs');
  const packs = readdirSync(packsDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(packsDir, f), 'utf8')));
  let loadedPacks = 0;
  const invoke = (key, input = packs) => runBackfillCli(['--operator-id', operatorId, packsDir], { KAREO_OPERATOR_KEY: key }, {
    knowledgeRepo: new SupabaseKnowledgeRepository(), operatorRepo: new SupabaseAdminKnowledgeRepository(),
    loadPacks: () => { loadedPacks++; return input; }, log: () => {}, error: () => {},
  });
  const counts = async () => (await db.query(`select (select count(*)::int from content_packs) packs,
    (select count(*)::int from knowledge_record_review_events) reviews`)).rows[0];
  const results = [];
  const pass = (id, detail) => results.push({ id, status: 'PASS', detail });
  assert.equal(await invoke('incorrect-synthetic-key'), 1);
  assert.equal(loadedPacks, 0); assert.equal(writes, 0);
  pass('BF-01', 'Incorrect personal key rejected before loading packs or making RPC writes');
  assert.equal(await invoke(operatorKey), 0);
  assert.deepEqual(await counts(), { packs: 5, reviews: 21 });
  pass('BF-02', 'Actual protected CLI registers five matching packs and 21 historical review events in the local clone');
  assert.deepEqual(await knowledgeState(), original);
  pass('BF-03', 'Knowledge record content/status, published version and all memberships unchanged');
  const metadata = (await db.query('select * from content_packs order by id')).rows;
  assert.ok(metadata.every(p => p.imported_by === operatorId));
  pass('BF-04', 'Import attribution is the authenticated synthetic local operator, not a fabricated cloud execution');
  assert.equal(await invoke(operatorKey), 0);
  assert.deepEqual(await counts(), { packs: 5, reviews: 21 });
  assert.deepEqual((await db.query('select * from content_packs order by id')).rows, metadata);
  pass('BF-05', 'Rerun adds no duplicate review events and preserves first import metadata');
  const changed = structuredClone(packs);
  changed[0].records[0].summary += ' synthetic tamper';
  assert.equal(await invoke(operatorKey, changed), 1);
  assert.deepEqual(await counts(), { packs: 5, reviews: 21 });
  assert.deepEqual(await knowledgeState(), original);
  assert.deepEqual((await db.query('select * from content_packs order by id')).rows, metadata);
  pass('BF-06', 'Changed submitted content is rejected and leaves existing metadata/content/reviews unchanged');
  await db.query('update internal_operators set active=false where id=$1', [operatorId]);
  const beforeWrites = writes, beforeLoads = loadedPacks;
  assert.equal(await invoke(operatorKey), 1);
  assert.equal(writes, beforeWrites); assert.equal(loadedPacks, beforeLoads);
  pass('BF-07', 'Disabled operator rejected before reading packs or attempting writes');
  writeFileSync(args.output, JSON.stringify({ status: 'PASS', scope: 'offline clone rehearsal, not cloud backfill or deployed E2E',
    sourceProject: snapshot.projectRef, snapshotSha256: createHash('sha256').update(raw).digest('hex'),
    backend: 'PGlite + local GET/RPC shim; actual CLI, repositories, supabase-js and repository SQL',
    limitations: 'Local shim has no JWT/RLS evaluation; database privileges and real deployment require separate verification.',
    executedAt: new Date().toISOString(), counts: await counts(), results, cloudWrites: 0 }, null, 2) + '\n');
  console.log(`PASS: ${results.length} backfill rehearsal cases; 5 packs / 21 reviews in local clone; zero cloud writes`);
} catch {
  console.error('Content backfill rehearsal failed; no cloud data modified.'); process.exitCode = 1;
} finally {
  if (server) await new Promise(r => server.close(r));
  await readShim?.close(); await db?.close();
}
