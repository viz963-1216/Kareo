// J-003 minimal PostgREST read shim over PGlite (local tests only, no network beyond 127.0.0.1).
//
// Lets the real @supabase/supabase-js client and the real API repositories run their SELECT queries against the
// isolated database in verify-db.mjs, so a test exercises the query the deployed code builds instead of a
// hand-written copy of it. Only what reads need is implemented:
//   GET /rest/v1/<table>?select=a,b,fk_table(c)&col=eq.x&col=in.(x,y)&order=col.desc&limit=n
// Anything else (writes, RPC, unknown operators, unknown identifiers) answers with a PostgREST-shaped error, so an
// unsupported query fails loudly instead of returning a wrong answer. It is not PostgREST: no JWT, no role switch
// (queries run as the PGlite superuser), no RLS evaluation. Privileges are checked separately (verify-db M3/M4).
import { createServer } from 'node:http';

const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (name) => {
  if (!IDENT.test(name)) throw Object.assign(new Error(`unsupported identifier: ${name}`), { code: 'PGRST100' });
  return `"${name}"`;
};

// Split on commas that are not inside parentheses or double quotes.
function splitTop(s) {
  const out = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v);

// Many-to-one embed: <table>.<fk col> references <target>.<col>.
async function foreignKey(db, table, target) {
  const { rows } = await db.query(`select a.attname as col, fa.attname as ref
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[1]
    where c.contype = 'f' and c.conrelid = $1::regclass and c.confrelid = $2::regclass`, [`public.${table}`, `public.${target}`]);
  if (rows.length !== 1) throw Object.assign(new Error(`no single foreign key from ${table} to ${target}`), { code: 'PGRST200' });
  return rows[0];
}

async function buildSelect(db, table, url) {
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const cols = [];
  for (const item of splitTop(url.searchParams.get('select') ?? '*')) {
    const embed = item.match(/^([a-z_][a-z0-9_]*)\((.*)\)$/);
    if (item === '*') cols.push('t.*');
    else if (embed) {
      const [, target, inner] = embed;
      const fk = await foreignKey(db, table, target);
      const innerCols = splitTop(inner).map((c) => (c === '*' ? 'e.*' : `e.${q(c)}`)).join(', ');
      cols.push(`(select row_to_json(x) from (select ${innerCols} from public.${q(target)} e where e.${q(fk.ref)} = t.${q(fk.col)}) x) as ${q(target)}`);
    } else cols.push(`t.${q(item)}`);
  }
  const where = [];
  const ops = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
  for (const [key, raw] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const dot = raw.indexOf('.');
    const op = raw.slice(0, dot), value = raw.slice(dot + 1);
    if (ops[op]) where.push(`t.${q(key)} ${ops[op]} ${p(unquote(value))}`);
    else if (op === 'is' && ['null', 'true', 'false'].includes(value)) where.push(`t.${q(key)} is ${value}`);
    else if (op === 'in' && value.startsWith('(') && value.endsWith(')')) {
      const list = splitTop(value.slice(1, -1)).map(unquote);
      where.push(list.length ? `t.${q(key)} in (${list.map(p).join(', ')})` : 'false');
    } else throw Object.assign(new Error(`unsupported filter ${key}=${raw}`), { code: 'PGRST100' });
  }
  const order = (url.searchParams.get('order') ?? '').split(',').filter(Boolean).map((o) => {
    const [c, ...mods] = o.split('.');
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : '';
    return `t.${q(c)} ${dir}${nulls}`;
  });
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  const sql = `select ${cols.join(', ')} from public.${q(table)} t${where.length ? ` where ${where.join(' and ')}` : ''}`
    + `${order.length ? ` order by ${order.join(', ')}` : ''}${limit ? ` limit ${Number(limit)}` : ''}${offset ? ` offset ${Number(offset)}` : ''}`;
  return { sql, params };
}

/** Starts the shim on 127.0.0.1 (random port). `log` receives every request as "GET table?query". */
export async function startPostgrestReadShim(db, { log = [] } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    // bytea as PostgREST sends it: "\x" + hex.
    const bytea = (_k, v) => (v instanceof Uint8Array ? `\\x${Buffer.from(v).toString('hex')}` : v);
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body, bytea)); };
    const m = url.pathname.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)$/);
    log.push(`${req.method} ${url.pathname.replace('/rest/v1/', '')}${url.search}`);
    if (req.method !== 'GET' || !m) return send(405, { code: 'PGRST-SHIM', message: `read shim: ${req.method} ${url.pathname} not supported`, details: null, hint: null });
    try {
      const { sql, params } = await buildSelect(db, m[1], url);
      const { rows } = await db.query(sql, params);
      if ((req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')) {
        return rows.length === 1 ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
      }
      return send(200, rows);
    } catch (e) {
      return send(400, { code: e.code ?? 'PGRST-SHIM', message: e.message, details: null, hint: null });
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)), log };
}
