import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(readFileSync(resolve(root, f), 'utf8'));
export function inspectCatalog(providers, services, areas, infoRows, manifest, sourceRows) {
  const errors = [];
  const byId = new Map(providers.map(p => [p.id, p]));
  const info = new Map(infoRows.map(x => [x.providerId, x.publicInfo]));
  if (info.size !== infoRows.length) errors.push('Duplicate public metadata');
  const normalize = x => x.normalize('NFKC').replace(/\s/g, '').replace(/台/g, '臺').replace(/⾧/g, '長');
  if (sourceRows.homeCare.length !== 198 || manifest.homeCare.length !== 198 || manifest.homeCare.some((x, i) => x.serial !== i + 1)) errors.push('198-row source reconciliation is incomplete');
  for (const group of ['homeCare', 'assistive', 'branches']) {
    for (const item of manifest[group]) {
      if (!item.providerId) {
        if (item.status !== 'OUT_OF_SCOPE' || !item.reason) errors.push(`Missing disposition: ${group}/${item.serial}`);
        continue;
      }
      const p = byId.get(item.providerId);
      if (!p || !info.has(item.providerId)) { errors.push(`Source record missing: ${item.providerId}`); continue; }
      if (!['臺北市', '新北市'].includes(p.city)) errors.push(`Outside coverage: ${p.id}`);
      if (group !== 'branches' && normalize(item.sourceName) !== normalize(p.name)) errors.push(`Source identity differs: ${p.id}`);
      if (group === 'assistive') {
        const program = item.source === 'smart' ? 'SMART_TECH' : 'PURCHASE';
        if (p.type !== 'ASSISTIVE_DEVICE' || !info.get(p.id).assistivePrograms.includes(program)) errors.push(`Wrong official classification: ${p.id}`);
        if (item.status === 'ADDED_OR_MERGED' && areas.some(a => a.providerId === p.id && a.active)) errors.push(`Official directory cannot invent delivery areas: ${p.id}`);
      }
      if (group === 'branches' && (p.type !== 'OTHER' || services.some(s => s.providerId === p.id))) errors.push(`Branch entered recommendation: ${p.id}`);
    }
  }
  for (const [pid, v] of info) {
    if (!byId.has(pid) || !v.publicServices.length || !Array.isArray(v.assistivePrograms) || v.assistivePrograms.some(p => !['PURCHASE','SMART_TECH'].includes(p)) || !/^https:\/\//.test(v.sourceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(v.checkedAt)) errors.push(`Invalid public metadata: ${pid}`);
  }
  for (const source of ['ltc', 'disability', 'smart']) {
    const actual = manifest.assistive.filter(x => x.source === source);
    if (actual.length !== sourceRows[source].length || actual.some((x, i) => x.serial !== Number(sourceRows[source][i].serial) || x.sourceName !== sourceRows[source][i].name || x.sourceAddress !== sourceRows[source][i].address)) errors.push(`Official ${source} directory reconciliation is incomplete`);
  }
  for (const [i, source] of sourceRows.homeCare.entries()) {
    const item = manifest.homeCare[i];
    if (!item || item.sourceName !== source.name || item.sourceAddress !== source.address || item.sourceContractArea !== source.contractArea) errors.push(`HC source changed: ${i + 1}`);
  }
  return errors;
}
export function loadCatalog() {
  return [read('staging/providers.json'), read('staging/provider-services.json'), read('staging/provider-service-areas.json'), read('staging/provider-public-info.json'), read('qa/official-catalog-manifest.json'), {homeCare: read('raw/home-care-198-public-extract.json'), ltc: read('raw/assistive-ltc-public-extract.json'), disability: read('raw/assistive-disability-public-extract.json'), smart: read('raw/assistive-smart-public-extract.json')}];
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = loadCatalog();
  const errors = inspectCatalog(...args);
  for (const source of args[4].sources) {
    const hash = createHash('sha256').update(readFileSync(resolve(root, source.document))).digest('hex');
    if (hash !== source.sha256) errors.push(`Source snapshot changed: ${source.sourceId}`);
  }
  for (const e of errors) console.error(e);
  console.log(`Official catalogue: ${errors.length ? 'FAIL' : 'PASS'} — 198 home-care dispositions; ${args[0].length} unique resources`);
  process.exitCode = errors.length ? 1 : 0;
}
