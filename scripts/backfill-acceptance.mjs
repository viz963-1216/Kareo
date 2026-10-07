import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ACCEPTANCE_PROJECT = 'ojawadobnaxduxybqolk';
export const ACCEPTANCE_OPERATOR = 'OP-SU-ZIJIE-ACCEPTANCE';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function rowsDigest(rows) {
  const ordered = rows.map(row => JSON.stringify(canonical(row))).sort();
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}
export function assertPreserved(before, after) {
  for (const name of ['knowledge_records', 'knowledge_versions', 'knowledge_version_records']) {
    if (before[name].count !== after[name].count || before[name].digest !== after[name].digest) throw new Error('BACKFILL_CHANGED_PUBLISHED_DATA');
  }
}
export function assertTarget(env) {
  if (env.SUPABASE_URL !== `https://${ACCEPTANCE_PROJECT}.supabase.co`
    || env.KAREO_OPERATOR_ID !== ACCEPTANCE_OPERATOR
    || !env.SUPABASE_SERVICE_ROLE_KEY || !env.KAREO_OPERATOR_KEY) throw new Error('ACCEPTANCE_CONFIG_REQUIRED');
}

async function snapshot(client, names) {
  const out = {};
  for (const name of names) {
    const {data, error, count} = await client.from(name).select('*', {count:'exact'}).range(0, 999);
    if (error || !Array.isArray(data) || count !== data.length) throw new Error('INCOMPLETE_BACKFILL_SNAPSHOT');
    out[name] = {count, digest: rowsDigest(data)};
  }
  return out;
}

export async function main(env = process.env) {
  // Authentication precedes even the read-only snapshot. No key is printed.
  assertTarget(env);
  const [{runBackfillCli}, {SupabaseKnowledgeRepository}, {SupabaseAdminKnowledgeRepository}, {requireOperator}, {getSupabaseClient}] = await Promise.all([
    import('../apps/api/dist/scripts/backfillContentPacks.js'),
    import('../apps/api/dist/repositories/supabaseKnowledgeRepository.js'),
    import('../apps/api/dist/repositories/supabaseAdminKnowledgeRepository.js'),
    import('../apps/api/dist/services/internalOperatorService.js'),
    import('../apps/api/dist/repositories/supabaseClient.js'),
  ]);
  const operatorRepo = new SupabaseAdminKnowledgeRepository();
  await requireOperator(operatorRepo, env.KAREO_OPERATOR_ID, env.KAREO_OPERATOR_KEY, 'KNOWLEDGE_PUBLISHER');
  const client = getSupabaseClient();
  const fixed = ['knowledge_records', 'knowledge_versions', 'knowledge_version_records'];
  const metadata = ['content_packs', 'knowledge_record_review_events'];
  const before = await snapshot(client, fixed);
  if (before.knowledge_records.count !== 21 || before.knowledge_versions.count !== 1 || before.knowledge_version_records.count !== 21) throw new Error('UNEXPECTED_ACCEPTANCE_BASELINE');
  const packsDir = resolve('contracts/knowledge/packs');
  const packs = readdirSync(packsDir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(resolve(packsDir, f), 'utf8')));
  if (packs.length !== 5) throw new Error('UNEXPECTED_PACK_SET');
  const invoke = () => runBackfillCli(['--operator-id', env.KAREO_OPERATOR_ID, packsDir], env, {
    knowledgeRepo: new SupabaseKnowledgeRepository(), operatorRepo,
    loadPacks: () => packs, log: () => {}, error: () => {},
  });
  if (await invoke() !== 0) throw new Error('BACKFILL_REJECTED');
  const first = await snapshot(client, [...fixed, ...metadata]);
  assertPreserved(before, first);
  if (first.content_packs.count !== 5 || first.knowledge_record_review_events.count !== 21) throw new Error('INCOMPLETE_BACKFILL');
  if (await invoke() !== 0) throw new Error('REPEAT_BACKFILL_REJECTED');
  const repeat = await snapshot(client, [...fixed, ...metadata]);
  assertPreserved(before, repeat);
  for (const name of metadata) {
    if (first[name].count !== repeat[name].count || first[name].digest !== repeat[name].digest) throw new Error('BACKFILL_NOT_IDEMPOTENT');
  }
  console.log(JSON.stringify({projectRef: ACCEPTANCE_PROJECT, operatorId: ACCEPTANCE_OPERATOR,
    executedBy:'Codex under Jerry delegation; not a new human content review',
    contentPacks:5, historicalReviewEvents:21, publishedDataPreserved:true, repeatMetadataPreserved:true,
    before, after:repeat, scope:'actual acceptance database backfill; not deployment E2E'}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {console.error('Acceptance backfill failed. Check authorization, source fingerprints and partial metadata; published-data verification has not passed.'); process.exitCode=1;});
}
