// J-004: application-data restore rehearsal into an in-memory PostgreSQL only.
// This does not restore Supabase Auth/Storage/platform settings or a physical backup.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const identifier = name => {
  if (!/^[a-z][a-z_]*$/.test(name)) throw new Error('Invalid application table identifier');
  return `public."${name}"`;
};

export async function verifyRestoredTables(db, tables) {
  const results = [];
  for (const [name, rows] of Object.entries(tables)) {
    const table = identifier(name);
    // Compare typed rows in BOTH directions: matching counts alone can hide wrong data.
    // PostgreSQL converts expected timestamps/json/arrays through the actual row type.
    const { rows: [diff] } = await db.query(`
      with expected as (select * from jsonb_populate_recordset(null::${table}, $1::jsonb)),
      missing as (select * from expected except all select * from ${table}),
      extra as (select * from ${table} except all select * from expected)
      select (select count(*)::int from ${table}) as restored,
             (select count(*)::int from missing) as missing,
             (select count(*)::int from extra) as extra`, [JSON.stringify(rows)]);
    results.push({ table: name, expected: rows.length, ...diff,
      status: diff.missing === 0 && diff.extra === 0 ? 'PASS' : 'FAIL' });
  }
  return results;
}

export async function insertSnapshotRows(db, tables) {
  // crawler_runs <-> crawler_snapshots is a real cycle. In this disposable local
  // database, defer FK checking until COMMIT, then restore the exact FK modes.
  // Constraints stay enabled: a dangling reference rejects the entire restore.
  const { rows: constraints } = await db.query(`select child.relname as child,
    c.conname, c.condeferrable, c.condeferred from pg_constraint c
    join pg_class child on child.oid=c.conrelid join pg_namespace n on n.oid=child.relnamespace
    where c.contype='f' and n.nspname='public'`);
  const quotedConstraint = name => {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Invalid constraint identifier');
    return `"${name}"`;
  };
  for (const c of constraints) await db.exec(`alter table ${identifier(c.child)}
    alter constraint ${quotedConstraint(c.conname)} deferrable initially deferred`);
  await db.exec('begin');
  try {
    for (const [name, rows] of Object.entries(tables)) await db.query(`insert into ${identifier(name)}
      select * from jsonb_populate_recordset(null::${identifier(name)}, $1::jsonb)`, [JSON.stringify(rows)]);
    await db.exec('commit');
  } catch (error) { await db.exec('rollback'); throw error; }
  finally {
    for (const c of constraints) await db.exec(`alter table ${identifier(c.child)}
      alter constraint ${quotedConstraint(c.conname)} ${c.condeferrable ? 'deferrable' : 'not deferrable'}
      initially ${c.condeferred ? 'deferred' : 'immediate'}`);
  }
}

export async function restoreApplicationSnapshot(db, snapshot, migrationsDir) {
  if (snapshot.format !== 'kareo-app-snapshot-v1' || !/^\d{4}$/.test(snapshot.schemaThrough)
      || !snapshot.tables || typeof snapshot.tables !== 'object' || Array.isArray(snapshot.tables)) {
    throw new Error('Unsupported snapshot metadata');
  }
  for (const [name, rows] of Object.entries(snapshot.tables)) {
    identifier(name);
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('Invalid application snapshot rows');
    }
  }
  await db.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;');
  const files = readdirSync(migrationsDir).filter(f => /^\d{4}_.+\.sql$/.test(f)
    && f.slice(0, 4) <= snapshot.schemaThrough).sort();
  if (files.length !== Number(snapshot.schemaThrough)
      || files.some((f, i) => Number(f.slice(0, 4)) !== i + 1)) throw new Error('Incomplete migration sequence');
  for (const f of files) await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));

  const { rows: schema } = await db.query("select tablename from pg_tables where schemaname='public' order by tablename");
  const expectedNames = Object.keys(snapshot.tables).sort();
  if (JSON.stringify(schema.map(r => r.tablename)) !== JSON.stringify(expectedNames)) {
    throw new Error('Snapshot must include every application table, including empty tables');
  }
  await insertSnapshotRows(db, snapshot.tables);

  const tables = await verifyRestoredTables(db, snapshot.tables);
  const { rows: rls } = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
  const { rows: grants } = await db.query(`select table_name from information_schema.role_table_grants
    where table_schema='public' and grantee in ('anon','authenticated')`);
  const { rows: knowledge } = await db.query(`select count(*)::int as published_members,
    count(*) filter (where kr.id is null)::int as missing_records
    from knowledge_version_records m join knowledge_versions v on v.id=m.version_id
    left join knowledge_records kr on kr.id=m.knowledge_record_id where v.status='PUBLISHED'`);
  return { kind: 'application-logical-restore', physicalBackupRestored: false, target: 'isolated in-memory PGlite',
    sourceProject: snapshot.projectRef, schemaThrough: snapshot.schemaThrough, migrationsApplied: files.length,
    tables, rlsDisabledTables: rls.length, publicRoleGrants: grants.length, knowledge: knowledge[0],
    status: tables.every(r => r.status === 'PASS') && !rls.length && !grants.length
      && knowledge[0].missing_records === 0 ? 'PASS' : 'FAIL' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let db;
  try {
    const args = Object.fromEntries(process.argv.slice(2).map(a => {
      const m = a.match(/^--(snapshot|source-project|output)=(.+)$/);
      if (!m) throw new Error('Unsupported argument');
      return [m[1], m[2]];
    }));
    if (!args.snapshot || !args.output || !args['source-project']) throw new Error('Missing required arguments');
    const raw = readFileSync(args.snapshot);
    const snapshot = JSON.parse(raw.toString());
    if (snapshot.projectRef !== args['source-project']) throw new Error('Source project does not match');
    const require = createRequire(join(root, 'tests/db/package.json'));
    const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
    db = new PGlite();
    const started = Date.now();
    const result = await restoreApplicationSnapshot(db, snapshot, join(root, 'apps/api/supabase/migrations'));
    result.durationMs = Date.now() - started;
    result.snapshotSha256 = createHash('sha256').update(raw).digest('hex');
    result.executedAt = new Date().toISOString();
    // Evidence contains table counts, not application rows, tokens or personal data.
    writeFileSync(args.output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(`${result.status}: ${result.tables.length} tables compared in both directions; ${result.durationMs} ms`);
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch {
    // Database/parser errors may contain original data; never echo them to shared logs.
    console.error('Application restore rehearsal failed; no cloud database was modified.');
    process.exitCode = 1;
  } finally { await db?.close(); }
}
