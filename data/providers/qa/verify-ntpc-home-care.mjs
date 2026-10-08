import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(readFileSync(resolve(root, f), 'utf8'));
export const norm = s => s.normalize('NFKC').replace(/\s/g, '').replace(/台/g, '臺').replace(/⾧/g, '長').replace(/㇐/g, '一');
const districtNames = new Set('板橋 三重 中和 永和 新莊 新店 土城 蘆洲 汐止 樹林 鶯歌 三峽 淡水 瑞芳 五股 泰山 林口 深坑 石碇 坪林 三芝 石門 八里 平溪 雙溪 貢寮 金山 萬里 烏來'.split(' ').map(x => x+'區'));
function sorted(x) { return Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sorted(x[k])])) : x; }
const fingerprint = x => createHash('sha256').update(JSON.stringify(sorted(x))).digest('hex');
function sourceAddress(raw) {
  let primary=norm(raw).split('辦公:')[0].split('遷址:').at(-1);
  primary=primary.replace(/^(.{2,3}市)[^區]+里\d+鄰([^區]{1,3}區)/,'$1$2');
  return primary.replace(/^((?:新北市|臺北市|桃園市|基隆市).+?區).+?里(?:\d+鄰)?/,'$1');
}
export function loadNtpc() {
  return {providers:read('staging/providers.json'), services:read('staging/provider-services.json'), areas:read('staging/provider-service-areas.json'), contracts:read('staging/provider-contract-regions.json'), info:read('staging/provider-public-info.json'), evidence:read('qa/a-003-evidence.json'), source:read('raw/ntpc-home-care-366-public-extract.json'), manifest:read('qa/ntpc-home-care-manifest.json'), baseline:read('qa/ntpc-home-care-baseline.json')};
}
export function inspectNtpc(d) {
  const errors = [];
  const byId = new Map(d.providers.map(x => [x.id, x]));
  const info = new Map(d.info.map(x => [x.providerId, x.publicInfo]));
  const {manifest:m, source} = d;
  const official=d.evidence.sources.find(s=>s.sourceId===m.sourceId);
  if (official?.sourceKind!=='OFFICIAL' || official.sha256!==m.sources[0].sha256 || official.url!==m.officialDirectoryUrl) errors.push('NTPC source registration differs from official snapshot');
  if (source.length !== 366 || m.rows.length !== 366 || source.some((x,i) => x.serial !== i+1) || m.rows.some((x,i) => x.serial !== i+1)) errors.push('366-row reconciliation incomplete');
  if (new Set(m.rows.map(x => x.providerId)).size !== m.rows.length) errors.push('Duplicate source identity mapping');
  const datasets = {'providers.json':d.providers,'provider-services.json':d.services,'provider-service-areas.json':d.areas,'provider-contract-regions.json':d.contracts};
  for (const [file, protectedRows] of Object.entries(d.baseline.files)) {
    const actual = new Map(datasets[file].map(x => [x.id,x]));
    for (const x of protectedRows) if (!actual.has(x.id) || fingerprint(actual.get(x.id)) !== x.sha256) errors.push(`Original 800 catalogue row changed: ${file}/${x.id}`);
  }
  const originalIds = new Set(d.baseline.files['providers.json'].map(x => x.id));
  const names = new Set();
  for (const p of d.providers.filter(p => p.type === 'HOME_CARE')) {
    const key = norm(p.name); if (names.has(key)) errors.push(`Duplicate home-care institution: ${p.id}`); names.add(key);
  }
  for (const row of source) {
    const x = m.rows[row.serial-1]; if (!x) continue;
    if (['sourceName','sourceAddress','sourcePhone','sourceServiceAreas'].some((k,i) => x[k] !== row[['name','address','phone','serviceAreas'][i]]) || x.page !== row.page) errors.push(`Source extract differs: ${row.serial}`);
    const p=byId.get(x.providerId); const v=info.get(x.providerId);
    if (!p || !v) { errors.push(`Source provider missing: ${row.serial}`); continue; }
    const paused = /暫停派案/.test(row.name);
    const expectedName=norm(row.name).replace(/\(暫停派案.*?\)/g,'');
    if (norm(p.name) !== expectedName || p.type !== 'HOME_CARE' || row.homeCare !== '✔') errors.push(`Source institution identity differs: ${row.serial}`);
    if (x.suspended !== paused || (paused && (p.status !== 'INACTIVE' || d.services.some(s=>s.providerId===p.id && s.active))) || (!paused && p.status !== 'ACTIVE')) errors.push(`Suspended provider eligibility incorrect: ${p.id}`);
    if (!originalIds.has(p.id)) {
      const address=sourceAddress(row.address);
      const cityDistrict=address.match(/^(.{2,3}市)(.{1,3}區)/);
      if (p.address!==address || p.city!==cityDistrict?.[1] || p.district!==cityDistrict?.[2]) errors.push(`Source address differs: ${p.id}`);
      const first=norm(row.phone).split('或')[0].match(/^([0-9-]+(?:#[0-9]+)?)/)?.[1];
      if (p.phone !== first) errors.push(`First source phone corrupted: ${p.id}`);
      if (p.lat !== null || p.lng !== null) errors.push(`Unverified coordinate invented: ${p.id}`);
      if (x.status !== (paused?'ADDED_SUSPENDED':'ADDED')) errors.push(`Incorrect new source disposition: ${p.id}`);
    } else if (x.status !== 'MERGED_EXISTING') errors.push(`Incorrect retained source disposition: ${p.id}`);
    const districts=norm(row.serviceAreas).split('、').map(x=>x+'區');
    if (new Set(districts).size !== districts.length || districts.some(x=>!districtNames.has(x)) || JSON.stringify(x.districts)!==JSON.stringify(districts)) errors.push(`Unsupported source district: ${row.serial}`);
    const actual=d.areas.filter(a=>a.providerId===p.id && a.city==='新北市' && a.active).map(a=>a.district);
    if (districts.some(di=>!actual.includes(di))) errors.push(`Source district missing: ${p.id}`);
    // Older protected area claims remain; every added claim must occur in this official row.
    const protectedAreaIds=new Set(d.baseline.files['provider-service-areas.json'].map(x=>x.id));
    if (d.areas.some(a=>a.providerId===p.id && !protectedAreaIds.has(a.id) && (a.city!=='新北市' || !districts.includes(a.district)))) errors.push(`Invented service coverage: ${p.id}`);
    const claims=d.evidence.serviceAreas.filter(a=>a.providerId===p.id && a.city==='新北市').flatMap(a=>[a,...(a.additionalSources??[])]).filter(a=>a.sourceId===m.sourceId);
    if (claims.length !== 1 || JSON.stringify(claims[0].districts)!==JSON.stringify(districts) || claims[0].sourceText!==norm(row.serviceAreas)) errors.push(`Official service evidence differs: ${p.id}`);
    if (x.outsideLocatedCity !== !['臺北市','新北市'].includes(p.city)) errors.push(`Incorrect cross-city source classification: ${p.id}`);
    if (!v.publicServices.includes('新北長照特約居家服務') || !v.notice.includes('1151007')) errors.push(`Public source metadata missing: ${p.id}`);
    for (const [field, label] of [['respite','新北特約居家喘息服務'],['shortCare','新北特約短照服務']]) {
      if (v.publicServices.includes(label) !== (row[field] === '✔')) errors.push(`Unsupported public service claim: ${p.id}/${field}`);
    }
  }
  const totals={sourceRows:source.length,newProviders:m.rows.filter(x=>!originalIds.has(x.providerId)).length,mergedExisting:m.rows.filter(x=>originalIds.has(x.providerId)).length,suspendedProviders:m.rows.filter(x=>x.suspended).length,outsideLocatedCity:m.rows.filter(x=>x.outsideLocatedCity).length,providers:d.providers.length,homeCare:d.providers.filter(x=>x.type==='HOME_CARE').length,activeHomeCare:d.providers.filter(x=>x.type==='HOME_CARE' && x.status==='ACTIVE').length,providerServices:d.services.length,providerServiceAreas:d.areas.length,newServiceAreas:d.areas.length-d.baseline.files['provider-service-areas.json'].length,providerContractRegions:d.contracts.length,publicMetadata:d.info.length};
  if (JSON.stringify(totals)!==JSON.stringify(m.totals)) errors.push('NTPC manifest totals differ');
  return errors;
}
export function verifyNtpcFiles(d = loadNtpc()) {
  const errors=inspectNtpc(d);
  for (const f of d.manifest.sources) if (createHash('sha256').update(readFileSync(resolve(root,f.document))).digest('hex')!==f.sha256) errors.push(`NTPC source snapshot changed: ${f.document}`);
  return errors;
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const errors=verifyNtpcFiles(); for (const e of errors) console.error(e);
  console.log(`NTPC home-care: ${errors.length?'FAIL':'PASS'}; all 366 source rows reconciled`); process.exitCode=errors.length?1:0;
}
