import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCatalog, loadCatalog } from '../verify-official-catalog.mjs';
test('every source row is retained, merged or explicitly excluded', () => assert.deepEqual(inspectCatalog(...loadCatalog()), []));
test('dropping a provider or programme fails source reconciliation', () => {
  const d = loadCatalog(); const id = d[4].assistive.find(x => x.providerId && x.source === 'smart').providerId;
  d[0] = d[0].filter(p => p.id !== id); assert.match(inspectCatalog(...d).join('\n'), /Source record missing/);
});
test('a contract classification cannot silently create recommendation coverage', () => {
  const d = loadCatalog(); const id = d[4].assistive.find(x => x.status === 'ADDED_OR_MERGED').providerId;
  d[2].push({providerId:id, city:'臺北市', district:'中正區', active:true}); assert.match(inspectCatalog(...d).join('\n'), /cannot invent delivery/);
});
test('198 is the input source count, not an invented in-scope total', () => {
  const d = loadCatalog(); const excluded = d[4].homeCare.filter(x => !x.providerId);
  assert.deepEqual(excluded.map(x => x.serial), [142]);
  d[4].homeCare.pop(); assert.match(inspectCatalog(...d).join('\n'), /198-row/);
});
