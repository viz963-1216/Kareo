// GET-only deployed component evidence; does not complete the UI/network E2E cases.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveReleaseTarget, deploymentUrl } from '../../scripts/lib/release-target.mjs';
import { observeDeployment, deploymentEvidence } from './deployment-evidence.mjs';

const args = process.argv.slice(2), target = resolveReleaseTarget(args);
const out = args.find(a => a.startsWith('--out='))?.slice(6);
if (target.problems.length || !out || target.env.key !== 'https://kareo-tw.netlify.app') {
  console.error('Exact Kareo acceptance URL/SHA and output required. No requests attempted.');
  process.exit(2);
}
const before = await observeDeployment(target.env);
if (before.commit !== target.commit) { console.error('Version mismatch; no query checks attempted.'); process.exit(1); }
const startedAt = new Date().toISOString(), checks = [], dataset = {};
function load(name) {
  const raw = readFileSync(new URL(`../../data/providers/staging/${name}.json`, import.meta.url));
  dataset[name] = { sha256: createHash('sha256').update(raw).digest('hex') };
  return JSON.parse(raw);
}
const providers = load('providers').filter(p => p.status === 'ACTIVE');
const services = load('provider-services').filter(p => p.active);
const areas = load('provider-service-areas').filter(p => p.active);
const contracts = load('provider-contract-regions').filter(p => p.active);
const infos = new Map(load('provider-public-info').map(p => [p.providerId, p.publicInfo]));
const byId = new Map(providers.map(p => [p.id, p]));
const lookupFields = ['id','name','type','resourceCategory','services','address','city','district','phone',
  'website','googleMapsUrl','verified','serviceAreaStatus','contractRegions','areaMatch'];
const knowledgeFields = ['id','title','category','jurisdiction','summary','effectiveFrom','effectiveTo','publishedAt','lastVerifiedAt','source'];
const equalSet = (actual, expected) => assert.deepEqual([...actual].sort(), [...expected].sort());
const hasService = (p, type) => services.some(s => s.providerId === p.id && s.serviceType === type);
const hasArea = p => areas.some(a => a.providerId === p.id);
const category = p => p.resourceCategory ?? 'SERVICE_PROVIDER';
let requests = 0;
async function query(name, path, params, verify, expectedStatus = 200) {
  const url = deploymentUrl(target.env, path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const receipt = { name, method: 'GET', path: url.pathname + url.search, expectedStatus };
  try {
    requests++;
    const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(30000) });
    receipt.httpStatus = r.status;
    assert.equal(r.status, expectedStatus);
    assert.ok(r.headers.get('content-type')?.includes('application/json'));
    const json = await r.json();
    assert.equal(json.success, expectedStatus === 200);
    if (expectedStatus !== 200) assert.equal(json.error?.code, 'VALIDATION_ERROR');
    else await verify(json.data);
    receipt.status = 'PASS';
  } catch { receipt.status = 'FAIL'; receipt.evidence = 'Response failed the named contract assertion; no raw response or exception recorded.'; }
  checks.push(receipt);
}
function lookup(expectedCount, inspect = () => {}) {
  return data => {
    assert.equal(data.totalCount, expectedCount);
    assert.ok(Array.isArray(data.items));
    assert.ok(data.items.length <= data.pageSize);
    assert.match(data.notice, data.totalCount === 0 ? /1966/ : /不是.*推薦/);
    assert.equal(new Set(data.items.map(p => p.id)).size, data.items.length);
    for (const p of data.items) {
      equalSet(Object.keys(p).filter(k => k !== 'publicInfo'), lookupFields);
      const expected = byId.get(p.id); assert.ok(expected);
      for (const field of ['id','name','type','address','city','district','phone','website','googleMapsUrl','verified'])
        assert.deepEqual(p[field], expected[field]);
      assert.equal(p.resourceCategory, category(expected));
      equalSet(p.services, services.filter(s => s.providerId === p.id).map(s => s.serviceType));
      assert.equal(p.serviceAreaStatus, hasArea(expected) ? 'VERIFIED' : 'UNCONFIRMED');
      equalSet(p.contractRegions.map(c => `${c.city}/${c.serviceType}`),
        contracts.filter(c => c.providerId === p.id).map(c => `${c.city}/${c.serviceType}`));
      assert.deepEqual(p.publicInfo ?? null, infos.get(p.id) ?? null);
    }
    inspect(data);
  };
}
const path = '/api/v1/providers'; let firstPage;
await query('all ACTIVE resources, first page and public fields', path, { pageSize: 20 }, lookup(providers.length, d => { firstPage = d.items.map(p => p.id); assert.equal(d.items.length, 20); }));
await query('second page retains total and has no duplicate first-page IDs', path, { page: 2, pageSize: 20 }, lookup(providers.length, d => {
  assert.ok(firstPage); assert.equal(d.items.length, 20); assert.ok(d.items.every(p => !firstPage.includes(p.id)));
}));
for (const type of ['HOME_CARE','HOME_MEDICAL_NURSING','ASSISTIVE_DEVICE'])
  await query(`service ${type}`, path, { serviceType: type, pageSize: 50 }, lookup(providers.filter(p => hasService(p, type)).length,
    d => assert.ok(d.items.every(p => p.services.includes(type)))));
await query('assistive centers have no recommendation service', path, { resourceCategory: 'ASSISTIVE_DEVICE_CENTER', pageSize: 50 },
  lookup(providers.filter(p => category(p) === 'ASSISTIVE_DEVICE_CENTER').length, d => assert.ok(d.items.every(p => p.type === 'OTHER' && p.services.length === 0))));
for (const city of ['臺北市','新北市'])
  await query(`assistive contract ${city}`, path, { serviceType: 'ASSISTIVE_DEVICE', contractCity: city, pageSize: 50 },
    lookup(providers.filter(p => hasService(p,'ASSISTIVE_DEVICE') && contracts.some(c => c.providerId === p.id && c.city === city && c.serviceType === 'ASSISTIVE_DEVICE')).length,
      d => assert.ok(d.items.every(p => p.contractRegions.some(c => c.city === city && c.serviceType === 'ASSISTIVE_DEVICE')))));
for (const program of ['PURCHASE','SMART_TECH'])
  await query(`official assistive program ${program}`, path, { serviceType: 'ASSISTIVE_DEVICE', assistiveProgram: program, pageSize: 50 },
    lookup(providers.filter(p => hasService(p,'ASSISTIVE_DEVICE') && infos.get(p.id)?.assistivePrograms.includes(program)).length,
      d => assert.ok(d.items.every(p => p.publicInfo?.assistivePrograms.includes(program)))));
await query('actual NTPC An-Yi name, city and district', path, { serviceType: 'HOME_CARE', city: '新北市', district: '板橋區', q: '安毅' },
  lookup(providers.filter(p => hasService(p,'HOME_CARE') && p.city === '新北市' && p.district === '板橋區' && p.name.includes('安毅')).length));
const unknownName = '韻譯科技有限公司';
const unknown = providers.filter(p => p.name.includes(unknownName) && hasService(p,'ASSISTIVE_DEVICE') && !hasArea(p));
assert.equal(unknown.length, 1); // Deliberate known formal-data fixture, never synthetic Provider data.
for (const include of [false,true])
  await query(`unknown service area ${include ? 'explicitly included' : 'excluded by default'}`, path,
    { serviceType:'ASSISTIVE_DEVICE', city:'臺北市', district:'中正區', areaFilter:'SERVICE_AREA', q:unknownName, ...(include ? { includeUnconfirmed:true } : {}) },
    lookup(include ? 1 : 0, d => { assert.equal(d.unconfirmedCount,1); if (include) assert.equal(d.items[0].areaMatch,'UNCONFIRMED'); }));
await query('empty name search has empty items', path, { q:'不存在的Kareo驗收機構20261009' }, lookup(0, d => assert.equal(d.items.length,0)));
await query('out-of-range page retains total', path, { page:99999 }, lookup(providers.length, d => assert.equal(d.items.length,0)));
for (const [name, params] of [['unsupported city',{city:'桃園市'}],['district without city',{district:'板橋區'}],
  ['forbidden distance sort',{sort:'distance'}],['center plus service',{resourceCategory:'ASSISTIVE_DEVICE_CENTER',serviceType:'ASSISTIVE_DEVICE'}]])
  await query(name,path,params,null,400);

const knowledgePath = '/api/v1/knowledge/records'; let knowledge;
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function verifyKnowledge(data) {
  assert.ok(Array.isArray(data.items)); assert.match(data.knowledgeVersion,/^KB-/);
  assert.ok(Number.isFinite(Date.parse(data.publishedAt))); assert.match(data.notice,/1966/);
  for (const item of data.items) {
    equalSet(Object.keys(item),knowledgeFields); equalSet(Object.keys(item.source),['title','publisher','url']);
    assert.ok(item.effectiveFrom <= today && (item.effectiveTo === null || item.effectiveTo >= today));
    assert.ok(item.source.title && item.source.publisher && item.summary);
    if (item.source.url !== null) {
      const u = new URL(item.source.url); assert.equal(u.protocol,'https:');
      assert.ok(u.hostname.endsWith('.gov.tw') || u.hostname.endsWith('.gov.taipei'));
    }
  }
}
await query('all current published valid knowledge, minimal public fields',knowledgePath,{pageSize:50},d => {
  verifyKnowledge(d); assert.equal(d.totalCount,21); assert.equal(d.items.length,21); knowledge=d;
});
for (const jurisdiction of ['TAIWAN','TAIPEI','NEW_TAIPEI'])
  await query(`knowledge jurisdiction ${jurisdiction}`,knowledgePath,{jurisdiction,pageSize:50},d => {
    verifyKnowledge(d); assert.ok(knowledge); assert.equal(d.knowledgeVersion,knowledge.knowledgeVersion);
    const expected=knowledge.items.filter(i=>i.jurisdiction===jurisdiction);
    assert.equal(d.totalCount,expected.length); equalSet(d.items.map(i=>i.id),expected.map(i=>i.id));
  });
await query('valid knowledge filter with no results',knowledgePath,{jurisdiction:'NEW_TAIPEI',category:'RESPITE'},d=>{
  verifyKnowledge(d); assert.equal(d.totalCount,0); assert.equal(d.items.length,0);
});
for (const [name, params] of [['invalid knowledge jurisdiction',{jurisdiction:'TAOYUAN'}],['invalid category',{category:'INVALID'}],['unknown knowledge parameter',{sort:'amount'}]])
  await query(name,knowledgePath,params,null,400);
const after = await observeDeployment(target.env);
const report = { schemaVersion:1, scope:'REAL_GET_ONLY_COMPONENT_CHECKS', releaseAcceptance:false,
  baseUrl:target.env.key, commit:target.commit, startedAt, finishedAt:new Date().toISOString(),
  deployment:deploymentEvidence(before,after,target.commit), dataset, requests, checks,
  summary:{pass:checks.filter(c=>c.status==='PASS').length,fail:checks.filter(c=>c.status==='FAIL').length},
  limitations:['No browser request capture or failure/retry/device/keyboard verification; E2E-44/45/47/48 remain PENDING.',
    'No Session/consent/health/contact/Lead/admin requests. No version withdrawal, deliberate rate-limit exhaustion or database writes.',
    'Public response checks are against this formal dataset; 21 knowledge records are the current observed published fixture, not proof of full publication lifecycle.'] };
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,requests,versionMatches:report.deployment.matches,releaseAcceptance:false}));
process.exitCode = report.deployment.matches && report.summary.fail===0 ? 0 : 1;
