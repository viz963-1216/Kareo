// J-003 isolated database verification (no cloud, no credentials, synthetic data only).
//
//   npm ci --prefix tests/db
//   node tests/db/verify-db.mjs [--migrations=apps/api/supabase/migrations] [--label=<text>] [--upgrade-from=0008]
//
// --upgrade-from=NNNN applies migrations up to NNNN first, seeds what an existing environment could already hold
// (a PUBLISHED knowledge version, a Provider), then applies the remaining migrations on top (upgrade path, U*).
//
// Runs every migration in filename order inside an in-process PostgreSQL (PGlite, WASM), then checks:
//   M  migration numbering, ordered apply, RLS and anon/authenticated privileges on every table and RPC
//   P  Provider import (D-10): a failing batch leaves no partial rows; a valid batch writes all three tables
//   K  Knowledge publish / withdraw (D-03, D-03-v2, D-10): only APPROVED, one PUBLISHED, version continuity,
//      traceability of earlier versions, withdraw → previous version or KNOWLEDGE_UNAVAILABLE, and K10: the
//      query the Assessment resolver uses (knowledge_records.version = current version) returns every record
//      that is actually in effect
//   C  Crawler (B-009) schema: open-change de-duplication, raw snapshot storage
//   R  Recommendation (B-005) schema: run + items written atomically
//
// This is NOT the staging Supabase: roles are emulated (anon / authenticated / service_role), there is no
// PostgREST, and nothing here proves a deployment. Results are recorded as "local isolated DB" in
// docs/INTEGRATION_ACCEPTANCE.md, never as E2E PASS. Exit 1 on any FAIL.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const arg = (name, fallback) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const migrationsDir = arg('migrations', 'apps/api/supabase/migrations');
const label = arg('label', migrationsDir);
const upgradeFrom = arg('upgrade-from', null);

const results = [];
const record = (status, id, detail, owner) => {
  results.push({ status, id, detail, owner });
  console.log(`${status.padEnd(8)} ${id.padEnd(4)} ${detail}${owner ? `  [owner: ${owner}]` : ''}`);
};

const db = new PGlite();
// Supabase roles that the migrations grant to / revoke from.
await db.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;');

async function fails(sql, params) {
  try { await db.query(sql, params); return null; } catch (e) { return e.message; }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const has = async (kind, name) => Boolean((await one(
  kind === 'fn' ? "select count(*)::int as n from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace"
    : "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = $1", [name])).n);
const col = async (table, column) => Boolean((await one(
  "select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2", [table, column])).n);

console.log(`Isolated DB verification — ${label}\n`);

// ---------- M: migrations ----------
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const numbers = files.map((f) => f.match(/^(\d{4})_/)?.[1]);
const dupes = numbers.filter((n, i) => n && numbers.indexOf(n) !== i);
const gaps = numbers.map(Number).filter((n, i, a) => i > 0 && n !== a[i - 1] + 1);
if (numbers.includes(undefined) || dupes.length || gaps.length) {
  record('FAIL', 'M1', `migration numbering: ${files.join(', ')}${dupes.length ? `; duplicate ${dupes}` : ''}${gaps.length ? `; gap before ${gaps}` : ''}`, 'module that added the migration');
} else record('PASS', 'M1', `${files.length} migrations, numbered ${numbers[0]}–${numbers.at(-1)} without gaps or duplicates`);

// ---------- shared knowledge helpers (column sets as of 0006; later migrations only add objects) ----------
let seq = 0;
async function ensureSource() {
  await db.query(`insert into knowledge_sources (id, name, authority, jurisdiction, source_url, active, created_at, updated_at)
    values ('J003-SRC', 'synthetic', 'MOHW', 'TAIWAN', 'https://1966.gov.tw/', true, now(), now()) on conflict (id) do nothing`);
}
async function addRecord({ title, type = 'T', status = 'APPROVED', effectiveTo = null, pack = 'J003-PACK-1', jurisdiction = 'TAIWAN' }) {
  const id = `J003-KREC-${++seq}`;
  const now = '2026-09-25T00:00:00+08:00';
  await db.query(`insert into knowledge_records (id, source_id, title, category, jurisdiction, source_url, effective_from, effective_to,
    fetched_at, last_verified_at, content_hash, status, raw_text, summary, rule_data, created_at, updated_at, pack_id, pack_record_id)
    values ($1, 'J003-SRC', $2, 'BENEFIT', $3, 'https://1966.gov.tw/', '2026-01-01', $4, $5, $5, $6, $7, 'synthetic', 'synthetic', $8::jsonb, $5, $5, $9, $1)`,
  [id, title, jurisdiction, effectiveTo, now, `sha256:${String(seq).padStart(64, '0')}`, status, JSON.stringify({ type }), pack]);
  return id;
}
const publish = (versionId, recordIds) => fails('select public.publish_knowledge_version($1::jsonb)', [JSON.stringify({ versionId, createdBy: 'J003-test', approvedBy: 'J003-test', recordIds })]);
const withdraw = (republishVersionId) => fails('select public.withdraw_knowledge_version($1::jsonb)', [JSON.stringify({ reason: 'J003 test', withdrawnBy: 'J003-test', republishVersionId })]);
const publishedVersion = async () => (await one("select id from knowledge_versions where status = 'PUBLISHED'"))?.id ?? null;
const publishedIds = async () => (await db.query("select id from knowledge_records where status = 'PUBLISHED' order by id")).rows.map((r) => r.id);
const ids = (rows) => rows.map((r) => r.id ?? r.knowledge_record_id).sort();
// What a version contains: the membership table when a migration provides one, otherwise the version column.
async function members(versionId) {
  if (await has('table', 'knowledge_version_records')) {
    return ids((await db.query('select knowledge_record_id from knowledge_version_records where version_id = $1', [versionId])).rows);
  }
  return ids((await db.query('select id from knowledge_records where version = $1', [versionId])).rows);
}
// The query the B-010 resolver (findPublishedSnapshotRecords) and B-008 knowledge/status run for the current version.
const readerSnapshot = async (versionId) => ids((await db.query("select id from knowledge_records where version = $1 and status = 'PUBLISHED'", [versionId])).rows);

let applied = 0;
const numberOf = (f) => f.slice(0, 4);
const before = upgradeFrom ? files.filter((f) => numberOf(f) <= upgradeFrom) : files;
const after = upgradeFrom ? files.filter((f) => numberOf(f) > upgradeFrom) : [];
async function applyAll(list) {
  for (const f of list) {
    try { await db.exec(readFileSync(join(migrationsDir, f), 'utf8')); applied++; } catch (e) {
      record('FAIL', 'M2', `${f} failed to apply after ${applied} migrations: ${e.message}`, 'module that added the migration');
      return false;
    }
  }
  return true;
}
let seeded = null;
if (await applyAll(before) && upgradeFrom) {
  // What an environment at this migration level may already hold.
  await ensureSource();
  const r1 = await addRecord({ title: 'U-A', pack: 'J003-UP' });
  const r2 = await addRecord({ title: 'U-B', pack: 'J003-UP' });
  const e = await publish('KB-2026-09-20-001', [r1, r2]);
  seeded = e ? null : { version: 'KB-2026-09-20-001', records: [r1, r2].sort() };
  if (!seeded) record('FAIL', 'U0', `could not seed a published version at ${upgradeFrom}: ${e}`);
  if (await applyAll(after)) record('PASS', 'M2', `upgrade path: ${before.length} migrations (≤ ${upgradeFrom}) + seeded data, then ${after.length} more applied in order`);
} else if (applied === files.length) record('PASS', 'M2', `all ${applied} migrations applied in order on an empty database`);

// ---------- U: upgrade path (existing data survives and keeps working) ----------
if (seeded && applied === files.length) {
  const still = (await publishedVersion()) === seeded.version && JSON.stringify(await publishedIds()) === JSON.stringify(seeded.records);
  record(still ? 'PASS' : 'FAIL', 'U1', `version published before the upgrade is still PUBLISHED with its records (${await publishedVersion()}: ${(await publishedIds()).join(', ')})`, still ? undefined : 'migration that changed existing rows');
  const m = await members(seeded.version);
  const complete = JSON.stringify(m) === JSON.stringify(seeded.records);
  record(complete ? 'PASS' : 'FAIL', 'U2', `pre-upgrade version membership is complete after the upgrade (expected ${seeded.records.join(', ')}, got ${m.join(', ') || 'none'})`,
    complete ? undefined : 'B-008: knowledge_version_records has no backfill for versions published before the migration');
  const u3 = await addRecord({ title: 'U-A', pack: 'J003-UP2' });
  const eu = await publish('KB-2026-09-20-002', [u3]);
  const ew = eu ? eu : await withdraw(seeded.version);
  const back = await publishedIds();
  const restored = !ew && (await publishedVersion()) === seeded.version && JSON.stringify(back) === JSON.stringify(seeded.records);
  record(restored ? 'PASS' : 'FAIL', 'U3', `after the upgrade: publish a new version, withdraw it, restore the pre-upgrade version in full (got ${ew ?? back.join(', ')})`,
    restored ? undefined : 'B-008');
  if (await publishedVersion()) await withdraw(null); // leave no PUBLISHED version for the K checks
  const leftover = await publishedIds();
  if (leftover.length) record('FAIL', 'U4', `withdrawing the restored pre-upgrade version leaves records PUBLISHED without a PUBLISHED version: ${leftover.join(', ')}`, 'B-008');
  await db.query("update knowledge_records set status = 'SUPERSEDED' where status = 'PUBLISHED'"); // isolate K from U
}

const tables = (await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1")).rows;
const noRls = tables.filter((t) => !t.rowsecurity).map((t) => t.tablename);
const exposed = [];
for (const { tablename } of tables) {
  for (const role of ['anon', 'authenticated']) {
    const p = await one(`select has_table_privilege($1, $2, 'SELECT') s, has_table_privilege($1, $2, 'INSERT') i,
      has_table_privilege($1, $2, 'UPDATE') u, has_table_privilege($1, $2, 'DELETE') d`, [role, `public.${tablename}`]);
    if (p.s || p.i || p.u || p.d) exposed.push(`${role}→${tablename}`);
  }
}
record(noRls.length || exposed.length ? 'FAIL' : 'PASS', 'M3',
  noRls.length || exposed.length ? `RLS off: ${noRls.join(', ') || '-'}; client roles have table privileges: ${exposed.join(', ') || '-'}`
    : `${tables.length} tables: RLS on, no anon/authenticated table privileges`, noRls.length || exposed.length ? 'B (migration owner)' : undefined);

const fns = (await db.query("select p.oid::regprocedure::text as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' order by 1")).rows.map((r) => r.sig);
const callable = [];
for (const sig of fns) for (const role of ['anon', 'authenticated']) {
  if ((await one('select has_function_privilege($1, $2, \'EXECUTE\') x', [role, sig])).x) callable.push(`${role}→${sig}`);
}
const serviceMissing = [];
for (const sig of fns) if (!(await one("select has_function_privilege('service_role', $1, 'EXECUTE') x", [sig])).x) serviceMissing.push(sig);
record(callable.length || serviceMissing.length ? 'FAIL' : 'PASS', 'M4',
  callable.length || serviceMissing.length ? `anon/authenticated can execute: ${callable.join(', ') || '-'}; service_role cannot execute: ${serviceMissing.join(', ') || '-'}`
    : `${fns.length} RPC functions (${fns.map((s) => s.split('(')[0]).join(', ')}): service_role only`, callable.length || serviceMissing.length ? 'B (migration owner)' : undefined);

// ---------- P: provider import rollback (D-10) ----------
if (!(await has('fn', 'import_provider_dataset'))) record('PENDING', 'P1', 'import_provider_dataset not present', 'B-004');
else {
  const provider = (id) => ({ id, name: '回滾測試', type: 'HOME_CARE', address: '測試地址', city: '新北市', district: '三重區', lat: null, lng: null,
    phone: null, website: null, google_maps_url: null, status: 'ACTIVE', verified: false, created_at: '2026-09-23T00:00:00+08:00', updated_at: '2026-09-23T00:00:00+08:00' });
  const counts = async () => one(`select (select count(*)::int from providers where id like 'J003-%') p,
    (select count(*)::int from provider_services where id like 'J003-%') s, (select count(*)::int from provider_service_areas where id like 'J003-%') a`);
  const badService = await fails('select public.import_provider_dataset($1::jsonb)', [JSON.stringify({
    providers: [provider('J003-P1')], provider_services: [{ id: 'J003-S1', provider_id: 'J003-MISSING', service_type: 'HOME_CARE', active: true }], provider_service_areas: [] })]);
  const c1 = await counts();
  const badArea = await fails('select public.import_provider_dataset($1::jsonb)', [JSON.stringify({
    providers: [provider('J003-P1')], provider_services: [{ id: 'J003-S1', provider_id: 'J003-P1', service_type: 'HOME_CARE', active: true }],
    provider_service_areas: [{ id: 'J003-A1', provider_id: 'J003-MISSING', city: '新北市', district: '三重區', active: true }] })]);
  const c2 = await counts();
  const good = await fails('select public.import_provider_dataset($1::jsonb)', [JSON.stringify({
    providers: [provider('J003-P1')], provider_services: [{ id: 'J003-S1', provider_id: 'J003-P1', service_type: 'HOME_CARE', active: true }],
    provider_service_areas: [{ id: 'J003-A1', provider_id: 'J003-P1', city: '新北市', district: '三重區', active: true }] })]);
  const c3 = await counts();
  const rolledBack = badService && badArea && c1.p + c1.s + c1.a === 0 && c2.p + c2.s + c2.a === 0;
  record(rolledBack ? 'PASS' : 'FAIL', 'P1', `failing batch (stage 2 FK, stage 3 FK) → error and 0 rows left: ${JSON.stringify([c1, c2])}`, rolledBack ? undefined : 'B-004');
  record(!good && c3.p === 1 && c3.s === 1 && c3.a === 1 ? 'PASS' : 'FAIL', 'P2', `valid batch writes all three tables: ${good ?? JSON.stringify(c3)}`, good ? 'B-004' : undefined);
}

// ---------- K: knowledge lifecycle (synthetic records) ----------
if (!(await has('fn', 'publish_knowledge_version'))) record('PENDING', 'K*', 'publish_knowledge_version not present', 'B-008');
else {
  await ensureSource();
  const state = async () => JSON.stringify((await db.query('select id, status, version from knowledge_records order by id')).rows) + (await publishedVersion());

  const a = await addRecord({ title: 'A' });
  const b = await addRecord({ title: 'B' });
  const c = await addRecord({ title: 'C', jurisdiction: 'NEW_TAIPEI' });
  const pending = await addRecord({ title: 'D', status: 'NEEDS_REVIEW' });

  // K1 only APPROVED, atomic
  const snapshotBefore = await state();
  const err = await publish('KB-2026-09-25-001', [a, b, c, pending]);
  record(err && (await state()) === snapshotBefore ? 'PASS' : 'FAIL', 'K1', `publishing a NEEDS_REVIEW record is rejected and nothing changes (${err ? 'rejected' : 'ACCEPTED'})`, err ? undefined : 'B-008');

  const e1 = await publish('KB-2026-09-25-001', [a, b, c]);
  const v1Set = await publishedIds();
  record(!e1 && (await publishedVersion()) === 'KB-2026-09-25-001' && v1Set.length === 3 ? 'PASS' : 'FAIL', 'K2',
    `first version KB-2026-09-25-001 publishes the 3 APPROVED records (${e1 ?? v1Set.length})`, e1 ? 'B-008' : undefined);

  // K3 duplicate version id
  const dupe = await addRecord({ title: 'E' });
  const eDupe = await publish('KB-2026-09-25-001', [dupe]);
  record(eDupe ? 'PASS' : 'FAIL', 'K3', `re-publishing an existing version id is rejected (${eDupe ? 'rejected' : 'ACCEPTED — published version overwritten'})`, eDupe ? undefined : 'B-008-r2');

  // K4 version continuity (D-03-v2): second version replaces A only; B, C must still be in effect.
  const a2 = await addRecord({ title: 'A', pack: 'J003-PACK-2' });
  const e2 = await publish('KB-2026-09-25-002', [a2, ...(eDupe ? [] : [])]);
  const v2Set = await publishedIds();
  const carried = [b, c].every((id) => v2Set.includes(id)) && v2Set.includes(a2) && !v2Set.includes(a);
  record(!e2 && carried ? 'PASS' : 'FAIL', 'K4', `new version keeps unreplaced records in effect and supersedes the replaced one (published now: ${v2Set.join(', ')})`, carried ? undefined : 'B-008-r2 (D-03-v2)');

  // K10 reader invariant: the Assessment resolver and knowledge/status read the current version by
  // knowledge_records.version. After a carry-forward that query must still return every record in effect.
  const current = await publishedVersion();
  const reader = await readerSnapshot(current);
  const inEffect = (await publishedIds()).sort();
  const readerOk = JSON.stringify(reader) === JSON.stringify(inEffect);
  record(readerOk ? 'PASS' : 'FAIL', 'K10', `resolver query for ${current} returns every record in effect (expected ${inEffect.join(', ')}, resolver gets ${reader.join(', ') || 'none'})`,
    readerOk ? undefined : 'B-010 findPublishedSnapshotRecords + B-008 knowledge/status: read the version through knowledge_version_records');

  // K5 traceability: the record set of KB-...-001 must still be derivable after 002 is published.
  const v1Now = await members('KB-2026-09-25-001');
  const traceable = JSON.stringify(v1Now) === JSON.stringify([...v1Set].sort());
  record(traceable ? 'PASS' : 'FAIL', 'K5', `earlier version remains traceable: KB-2026-09-25-001 contains ${JSON.stringify(v1Now)} (published as ${JSON.stringify(v1Set)})`,
    traceable ? undefined : 'B-008: carry-forward rewrites membership of the earlier version');

  // K6 withdraw 002 and restore 001: the restored version must be exactly what 001 published.
  const e6 = await withdraw('KB-2026-09-25-001');
  const restored = await publishedIds();
  const exact = !e6 && (await publishedVersion()) === 'KB-2026-09-25-001' && JSON.stringify(restored) === JSON.stringify(v1Set);
  record(exact ? 'PASS' : 'FAIL', 'K6', `withdraw 002 → republish 001 restores its full content (expected ${JSON.stringify(v1Set)}, got ${e6 ?? JSON.stringify(restored)})`,
    exact ? undefined : 'B-008-r2: records carried into 002 are not restored with 001');

  // K7 a withdrawn version must not be republished in the same step.
  const cur = await publishedVersion();
  const e7 = await withdraw(cur);
  const after7 = await publishedVersion();
  const blocked = Boolean(e7) || after7 !== cur;
  record(blocked ? 'PASS' : 'FAIL', 'K7', `withdraw ${cur} with republishVersionId=${cur} is rejected (${e7 ? 'rejected' : `ACCEPTED — ${after7} is PUBLISHED again`})`,
    blocked ? undefined : 'B-008: withdraw_knowledge_version marks it ARCHIVED, then accepts it as the republish target');

  // K8 withdraw without a replacement → no PUBLISHED version (Assessment must return KNOWLEDGE_UNAVAILABLE).
  if (await publishedVersion()) await withdraw(null);
  const none = (await publishedVersion()) === null && (await publishedIds()).length === 0;
  record(none ? 'PASS' : 'FAIL', 'K8', `withdraw without replacement leaves no PUBLISHED version or record (${none ? 'none' : await publishedVersion()})`, none ? undefined : 'B-008');

  // K9 expired records are not carried into a new version (D-03 #2).
  if (await col('knowledge_records', 'effective_to')) {
    const x = await addRecord({ title: 'X', pack: 'J003-PACK-3' });
    const y = await addRecord({ title: 'Y', pack: 'J003-PACK-3', effectiveTo: '2026-01-31' });
    await publish('KB-2026-09-25-003', [x, y]);
    const z = await addRecord({ title: 'Z', pack: 'J003-PACK-4' });
    await publish('KB-2026-09-25-004', [z]);
    const live = await publishedIds();
    const k9 = !live.includes(y) && live.includes(x);
    record(k9 ? 'PASS' : 'FAIL', 'K9', `expired record is not carried forward and the unexpired one is (published: ${live.join(', ')})`, k9 ? undefined : 'B-008-r2 (D-03 #2, D-03-v2)');
  }
}

// ---------- C: crawler (B-009) ----------
if (!(await has('table', 'crawler_runs'))) record('PENDING', 'C*', 'crawler_runs not present', 'B-009');
else {
  await ensureSource();
  const base = await addRecord({ title: 'C-BASE', status: 'PUBLISHED', pack: 'J003-C' });
  const change = (id) => fails(`insert into knowledge_changes (id, knowledge_record_id, old_content_hash, new_content_hash, old_content, new_content, status, detected_at)
    values ($1, $2, 'sha256:old', 'sha256:new', 'old', 'new', 'NEEDS_REVIEW', now())`, [id, base]);
  const first = await change('J003-KCHG-1');
  const second = await change('J003-KCHG-2');
  record(!first && second ? 'PASS' : 'FAIL', 'C1', `the same open change (record, new hash) cannot be stored twice (${first ?? 'first stored'}; second ${second ? 'rejected' : 'ACCEPTED'})`, !first && second ? undefined : 'B-009');
  const snapshotStore = (await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public'
    and (table_name like '%snapshot%' or column_name in ('raw_snapshot', 'raw_content', 'raw_bytes', 'snapshot_path', 'snapshot_ref', 'storage_path'))`)).rows;
  record(snapshotStore.length ? 'PASS' : 'FAIL', 'C2', snapshotStore.length ? `raw snapshot storage: ${snapshotStore.map((r) => `${r.table_name}.${r.column_name}`).join(', ')}`
    : 'no raw snapshot storage (only hashes): a past fetch cannot be read back or re-hashed (TASK-B-009 Raw Snapshot)', snapshotStore.length ? undefined : 'B-009');
}

// ---------- R: recommendation (B-005) ----------
if (!(await has('table', 'recommendation_runs'))) record('PENDING', 'R*', 'recommendation_runs not present', 'B-005');
else {
  const rpc = (await db.query("select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like '%recommendation%'")).rows.map((r) => r.proname);
  record(rpc.length ? 'PASS' : 'FAIL', 'R1', rpc.length ? `atomic recommendation write function: ${rpc.join(', ')}`
    : 'run and items are two separate inserts (no single-transaction function); an items failure leaves a run without items (tests/integration/repro/b005-distance-and-write.repro.ts)', rpc.length ? undefined : 'B-005');
}

const n = (s) => results.filter((r) => r.status === s).length;
console.log(`\nSummary: ${n('PASS')} PASS, ${n('FAIL')} FAIL, ${n('PENDING')} PENDING (local isolated DB, not a deployment)`);
process.exit(n('FAIL') ? 1 : 0);
