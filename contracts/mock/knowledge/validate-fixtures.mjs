// Public knowledge fixtures (API_CONTRACT §13a, D-19 Q3): format and consistency only — not backend or real API acceptance.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('./', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));

const JURISDICTIONS = ['TAIWAN', 'TAIPEI', 'NEW_TAIPEI'];
const CATEGORIES = ['ELIGIBILITY', 'BENEFIT', 'COPAY', 'ASSISTIVE_DEVICE', 'TRANSPORTATION', 'RESPITE', 'HOME_CARE', 'HOME_MEDICAL_NURSING', 'APPLICATION', 'OTHER'];
const ITEM_KEYS = ['id', 'title', 'category', 'jurisdiction', 'summary', 'effectiveFrom', 'effectiveTo', 'publishedAt', 'lastVerifiedAt', 'source'];
const SOURCE_KEYS = ['title', 'publisher', 'url'];
const FILTER_KEYS = ['jurisdiction', 'category', 'page', 'pageSize'];
const BANNED = ['您符合', '已核定', '您可獲得'];
const normalize = q => ({ jurisdiction: q.jurisdiction ?? null, category: q.category ?? null, page: q.page ?? 1, pageSize: q.pageSize ?? 20 });
const order = r => [JURISDICTIONS.indexOf(r.jurisdiction), CATEGORIES.indexOf(r.category), r.id];

const responses = readdirSync(root).filter(f => f.endsWith('-response.json'));
for (const file of responses) {
  const { success, data } = read(file);
  assert.equal(success, true, file);
  const req = read(`requests/${file.replace('-response.json', '-request.json')}`);
  assert.equal(req.path, '/api/v1/knowledge/records');
  assert.deepEqual(Object.keys(data.appliedFilters).sort(), [...FILTER_KEYS].sort(), `${file}: appliedFilters keys`);
  assert.deepEqual(data.appliedFilters, normalize(req.query), `${file}: appliedFilters`);
  assert.match(data.knowledgeVersion, /^KB-/, `${file}: knowledgeVersion`);
  assert.ok(data.notice.includes('1966'), `${file}: notice must point to 1966`);
  assert.ok(data.items.length <= data.pageSize, `${file}: page size`);
  data.items.forEach((r, i) => {
    assert.deepEqual(Object.keys(r).sort(), [...ITEM_KEYS].sort(), `${file}: ${r.id} fields (no ruleData／excerpt／hash／status／pack)`);
    assert.deepEqual(Object.keys(r.source).sort(), [...SOURCE_KEYS].sort(), `${file}: ${r.id} source fields`);
    assert.ok(JURISDICTIONS.includes(r.jurisdiction) && CATEGORIES.includes(r.category), `${file}: ${r.id} enums`);
    if (data.appliedFilters.jurisdiction) assert.equal(r.jurisdiction, data.appliedFilters.jurisdiction);
    if (data.appliedFilters.category) assert.equal(r.category, data.appliedFilters.category);
    if (r.source.url !== null) assert.match(r.source.url, /^https:\/\//, `${file}: ${r.id} url`);
    assert.ok(!(r.source.url ?? '').includes('drive.google.com'), `${file}: ${r.id} Drive links are not exposed`);
    for (const w of BANNED) assert.ok(!r.summary.includes(w), `${file}: ${r.id} summary must not say ${w}`);
    const prev = data.items[i - 1];
    if (prev) {
      const a = order(prev), b = order(r);
      const cmp = a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1);
      assert.ok(cmp < 0, `${file}: order ${prev.id} → ${r.id}`);
    }
  });
}
const errors = readdirSync(new URL('errors/', root));
for (const file of errors) {
  const res = read(`errors/${file}`);
  assert.equal(res.success, false);
  assert.ok(['VALIDATION_ERROR', 'KNOWLEDGE_UNAVAILABLE'].includes(res.error.code), file);
  read(`requests/error-${file.replace('-response.json', '-request.json')}`);
}
const first = read('records-first-page-response.json').data, second = read('records-second-page-response.json').data;
assert.equal(first.totalCount, second.totalCount);
assert.equal(first.items.length + second.items.length, first.totalCount, 'two pages cover all records');
console.log(`knowledge fixtures OK: ${responses.length} responses, ${errors.length} errors`);
