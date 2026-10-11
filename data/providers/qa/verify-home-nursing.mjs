import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nursingPhone } from './lib/home-nursing-phone.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(readFileSync(resolve(root, f), 'utf8'));
const sorted = x => Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sorted(x[k])])) : x;
const sha = x => createHash('sha256').update(x).digest('hex');
const normalize = s => s.normalize('NFKC').replace(/\s/g, '').replace(/台北/g, '臺北');
export function loadNursing() {
  return { providers: read('staging/providers.json'), services: read('staging/provider-services.json'), areas: read('staging/provider-service-areas.json'), contracts: read('staging/provider-contract-regions.json'), info: read('staging/provider-public-info.json'), source: read('raw/home-nursing-147-public-extract.json'), manifest: read('qa/home-nursing-manifest.json'), baseline: read('qa/home-nursing-baseline.json') };
}
export function inspectNursing(d) {
  const errors = [];
  const p = new Map(d.providers.map(p => [p.id,p]));
  const info = new Map(d.info.map(x => [x.providerId,x.publicInfo]));
  for (const [file, key] of [['providers.json','providers'],['provider-services.json','services'],['provider-service-areas.json','areas'],['provider-contract-regions.json','contracts'],['provider-public-info.json','info']]) {
    const actual = new Map(d[key].map(x => [x.id ?? x.providerId,x]));
    for (const row of d.baseline.files[file]) if (!actual.has(row.id) || sha(JSON.stringify(sorted(actual.get(row.id)))) !== row.sha256) errors.push(`Existing row changed: ${file}/${row.id}`);
  }
  if (d.source.length !== 147 || d.manifest.rows.length !== 147 || new Set(d.manifest.rows.map(r => r.providerId)).size !== 147) errors.push('147-row reconciliation incomplete');
  for (const [city,total] of [['臺北市',51],['新北市',96]]) {
    for (const rows of [d.source,d.manifest.rows]) if (JSON.stringify(rows.filter(r=>r.city===city).map(r=>r.serial)) !== JSON.stringify(Array.from({length:total},(_,i)=>i+1))) errors.push(`Official serials incomplete: ${city}`);
  }
  for (const [i,source] of d.source.entries()) {
    const row = d.manifest.rows[i]; if (!row) continue;
    if (row.city !== source.city || row.serial !== source.serial || row.page !== source.page || row.sourceName !== source.name || row.sourceAddress !== source.address || row.sourcePhone !== source.phone) errors.push(`Source extract differs: ${i}`);
    const provider = p.get(row.providerId), publicInfo = info.get(row.providerId);
    const registered = d.manifest.sources.find(s => s.sourceId===row.sourceId && s.city===row.city);
    if (!provider || !publicInfo || !registered) {errors.push(`Source provider missing: ${row.providerId}`);continue;}
    const address = normalize(source.address), district = address.match(/^(?:臺北市|新北市)(.{1,3}區)/)?.[1];
    if (normalize(provider.name)!==normalize(source.name) || normalize(provider.address)!==address || provider.city!==source.city || provider.district!==district || provider.type!=='HOME_MEDICAL_NURSING' || provider.status!=='ACTIVE') errors.push(`Official identity differs: ${row.providerId}`);
    const expectedPhone = nursingPhone(source.phone);
    if (row.normalizedPhone !== expectedPhone || (row.status==='ADDED' && provider.phone!==expectedPhone)) errors.push(`Source phone differs: ${row.providerId}`);
    if (!expectedPhone && !publicInfo.notice.includes('暫不提供撥號連結')) errors.push(`Unresolved phone hidden: ${row.providerId}`);
    if (!d.services.some(s=>s.providerId===row.providerId && s.serviceType==='HOME_MEDICAL_NURSING' && s.active) || publicInfo.sourceUrl!==registered.url || publicInfo.checkedAt!==d.manifest.checkedAt || !publicInfo.publicServices.includes('居家護理（官方居家護理所名冊）')) errors.push(`Public service or source missing: ${row.providerId}`);
    if (row.status==='ADDED' && (d.areas.some(a=>a.providerId===row.providerId) || d.contracts.some(a=>a.providerId===row.providerId) || provider.lat!==null || provider.lng!==null)) errors.push(`Invented coverage, contract or coordinate: ${row.providerId}`);
    if (!['ADDED','RETAINED'].includes(row.status) || (row.status==='RETAINED') !== ['TP-HMN-001','TP-HMN-002','TP-HMN-003'].includes(row.providerId)) errors.push(`Wrong disposition: ${row.providerId}`);
  }
  const nursing = d.providers.filter(p=>p.type==='HOME_MEDICAL_NURSING');
  if (nursing.length!==147 || new Set(nursing.map(p=>normalize(p.name)+'|'+normalize(p.address))).size!==147) errors.push('Duplicate or extraneous nursing institution');
  const expected = {sourceRows:147,taipei:51,newTaipei:96,added:144,retained:3,newServiceAreas:0,newContractRegions:0,providers:d.providers.length,services:d.services.length,publicMetadata:d.info.length,phoneIssues:d.source.filter(r=>nursingPhone(r.phone)===null).length};
  if (JSON.stringify(expected)!==JSON.stringify(d.manifest.totals)) errors.push('Nursing totals differ');
  return errors;
}
export function verifyNursingFiles(d=loadNursing()) {
  const errors=inspectNursing(d);
  for(const source of d.manifest.sources) if(sha(readFileSync(resolve(root,source.document)))!==source.sha256) errors.push(`Official snapshot changed: ${source.sourceId}`);
  return errors;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const errors=verifyNursingFiles();for(const e of errors) console.error(e);
  console.log(`Home nursing: ${errors.length?'FAIL':'PASS'} — 147 source rows, 144 additions, all 1118 original resources retained.`);process.exitCode=errors.length?1:0;
}
