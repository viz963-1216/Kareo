// Resource lookup fixtures (API_CONTRACT §10a, D-18／D-19): checks that list fixtures, detail fixtures and the
// recommendation fixture tell one consistent story. Format check only — not backend or real API acceptance.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('./', import.meta.url);
const read = (name, base = root) => JSON.parse(readFileSync(new URL(name, base), 'utf8'));
const mockRoot = new URL('../../', root);
const reference = read('../reference/service-districts.json', mockRoot);
const cityOrder = reference.cities.map(c => c.city);
const districtsOf = Object.fromEntries(reference.cities.map(c => [c.city, c.districts]));
const details = Object.fromEntries(
  readdirSync(new URL('../', root)).filter(f => f.endsWith('.json')).map(f => {
    const d = read(`../${f}`).data;
    return [d.id, d];
  }),
);

const FILTER_KEYS = ['resourceCategory', 'serviceType', 'city', 'district', 'areaFilter', 'includeUnconfirmed', 'contractCity', 'q', 'page', 'pageSize'];
const ITEM_KEYS = ['id', 'name', 'type', 'resourceCategory', 'services', 'address', 'city', 'district', 'phone', 'website', 'googleMapsUrl', 'verified', 'serviceAreaStatus', 'contractRegions', 'areaMatch'];
const SHARED_WITH_DETAIL = ITEM_KEYS.filter(k => k !== 'areaMatch');
const BANNED_WORDS = ['最近', '附近', '適合您', '一定可'];

for (const [id, d] of Object.entries(details)) {
  assert.equal(d.serviceAreaStatus, d.serviceAreas.length ? 'VERIFIED' : 'UNCONFIRMED', `${id}: serviceAreaStatus must follow serviceAreas`);
  assert.ok(['SERVICE_PROVIDER', 'ASSISTIVE_DEVICE_CENTER'].includes(d.resourceCategory), `${id}: resourceCategory`);
  if (d.resourceCategory === 'ASSISTIVE_DEVICE_CENTER') {
    assert.equal(d.type, 'OTHER', `${id}: centers use type OTHER`);
    assert.deepEqual(d.services, [], `${id}: centers have no ProviderService, so recommendation never selects them`);
  } else assert.ok(d.services.length > 0, `${id}: service providers have services`);
  assert.ok(Array.isArray(d.contractRegions), `${id}: contractRegions`);
  for (const r of d.contractRegions) {
    assert.ok(cityOrder.includes(r.city), `${id}: contract city`);
    assert.ok(d.services.includes(r.serviceType), `${id}: contract serviceType must be a service the provider offers`);
  }
}

const normalize = q => ({
  resourceCategory: q.resourceCategory ?? null, contractCity: q.contractCity ?? null,
  serviceType: q.serviceType ?? null, city: q.city ?? null, district: q.district ?? null,
  areaFilter: q.areaFilter ?? (q.city ? 'LOCATED_IN' : null), includeUnconfirmed: q.includeUnconfirmed ?? false,
  q: q.q ?? null, page: q.page ?? 1, pageSize: q.pageSize ?? 20,
});
const sortKey = d => [cityOrder.indexOf(d.city), districtsOf[d.city].indexOf(d.district), d.id];
const before = (a, b) => { const x = sortKey(a), y = sortKey(b); return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : 1); };

const responses = readdirSync(root).filter(f => f.endsWith('-response.json'));
assert.ok(responses.length >= 7, 'expected list fixtures');
for (const file of responses) {
  const res = read(file);
  assert.equal(res.success, true, file);
  const data = res.data;
  const req = read(`requests/${file.replace('-response.json', '-request.json')}`);
  assert.equal(req.method, 'GET'); assert.equal(req.path, '/api/v1/providers');
  assert.deepEqual(Object.keys(data.appliedFilters).sort(), [...FILTER_KEYS].sort(), `${file}: appliedFilters keys`);
  assert.deepEqual(data.appliedFilters, normalize(req.query), `${file}: appliedFilters must echo the normalized request`);
  const f = data.appliedFilters;
  assert.ok(data.items.length <= f.pageSize, `${file}: page size`);
  assert.ok(data.totalCount >= data.items.length + (f.page - 1) * f.pageSize || data.items.length === 0, `${file}: totalCount`);
  assert.equal(typeof data.notice, 'string'); assert.ok(data.notice.length > 0, `${file}: notice`);
  for (const w of BANNED_WORDS) assert.ok(!data.notice.includes(w), `${file}: notice must not say ${w}`);
  if (f.areaFilter === 'SERVICE_AREA') assert.equal(typeof data.unconfirmedCount, 'number', `${file}: unconfirmedCount`);
  else assert.equal(data.unconfirmedCount, null, `${file}: unconfirmedCount only for SERVICE_AREA`);
  let seenUnconfirmed = false;
  data.items.forEach((item, i) => {
    assert.deepEqual(Object.keys(item).sort(), [...ITEM_KEYS].sort(), `${file}: ${item.id} fields (no lat/lng/status/rank/distance/reasons)`);
    const detail = details[item.id];
    assert.ok(detail, `${file}: ${item.id} must have providers/${item.id}.json`);
    for (const k of SHARED_WITH_DETAIL) assert.deepEqual(item[k], detail[k], `${file}: ${item.id}.${k} must equal detail`);
    if (f.serviceType) assert.ok(item.services.includes(f.serviceType), `${file}: ${item.id} service`);
    if (f.q) assert.ok(item.name.includes(f.q), `${file}: ${item.id} keyword`);
    if (f.resourceCategory) assert.equal(item.resourceCategory, f.resourceCategory, `${file}: ${item.id} resourceCategory`);
    if (f.contractCity) assert.ok(item.contractRegions.some(r => r.city === f.contractCity && (!f.serviceType || r.serviceType === f.serviceType)), `${file}: ${item.id} contractCity`);
    if (f.areaFilter === 'LOCATED_IN') {
      assert.equal(item.areaMatch, null);
      assert.equal(item.city, f.city); if (f.district) assert.equal(item.district, f.district);
    } else if (f.areaFilter === 'SERVICE_AREA') {
      const covers = detail.serviceAreas.some(a => a.city === f.city && (!f.district || a.district === f.district));
      if (item.areaMatch === 'VERIFIED') { assert.ok(covers, `${file}: ${item.id} VERIFIED must be covered`); assert.ok(!seenUnconfirmed, `${file}: VERIFIED before UNCONFIRMED`); }
      else { assert.equal(item.areaMatch, 'UNCONFIRMED'); assert.equal(f.includeUnconfirmed, true); assert.equal(item.serviceAreaStatus, 'UNCONFIRMED'); seenUnconfirmed = true; }
    } else assert.equal(item.areaMatch, null);
    const prev = data.items[i - 1];
    if (prev && prev.areaMatch === item.areaMatch) assert.ok(before(prev, item) < 0, `${file}: order ${prev.id} → ${item.id}`);
  });
}

for (const file of readdirSync(new URL('errors/', root))) {
  const res = read(`errors/${file}`);
  assert.equal(res.success, false); assert.equal(res.error.code, 'VALIDATION_ERROR', file); assert.ok(res.error.message);
  read(`requests/error-${file.replace('-response.json', '-request.json')}`);
}

// Same institution: findable in lookup, but never recommended without a verified service area (D-18).
const located = read('list-located-in-response.json').data;
const recommended = read('../../recommendations/ASSISTIVE_DEVICE.json', root).data.providers.map(p => p.id);
const unconfirmed = located.items.filter(i => i.serviceAreaStatus === 'UNCONFIRMED');
assert.ok(unconfirmed.length > 0, 'contrast case needs an UNCONFIRMED provider located in the recommended district');
for (const item of unconfirmed) assert.ok(!recommended.includes(item.id), `${item.id} must not appear in the recommendation fixture`);

// Contract regions and resource centers never reach recommendation (D-19 Q1／Q2).
const recDir = new URL('../../recommendations/', root);
const recFiles = readdirSync(recDir, { recursive: true }).filter(f => f.endsWith('.json'));
for (const f of recFiles) {
  const providers = read(f, recDir).data.providers ?? [];
  for (const p of providers) {
    assert.ok(!('contractRegions' in p) && !('resourceCategory' in p), `${f}: recommendation cards must not carry lookup-only fields`);
    if (details[p.id]) assert.equal(details[p.id].resourceCategory, 'SERVICE_PROVIDER', `${f}: ${p.id} centers are never recommended`);
  }
}

console.log(`lookup fixtures OK: ${responses.length} list responses, ${readdirSync(new URL('errors/', root)).length} errors, ${Object.keys(details).length} details`);
