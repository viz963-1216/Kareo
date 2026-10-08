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
test('same name and doorplate with equivalent road segment spelling cannot inflate inventory', () => {
  const d = loadCatalog(); const p = d[0].find(p => p.name === '益康儀器有限公司' && p.address.includes('60號'));
  d[0].push({...p, id:'duplicate-address', address:p.address.replace('1段','一段')});
  assert.match(inspectCatalog(...d).join('\n'), /Duplicate merchant location/);
  const different = loadCatalog(); different[0].push({...p, id:'different-shop', address:p.address.replace('60號','61號')});
  assert.deepEqual(inspectCatalog(...different), []);
});
test('mobile and toll-free first numbers cannot be replaced by an internal 02 substring', () => {
  for (const id of ['TP-HC-012','TP-HC-044','TP-HC-110','TP-HC-185','CAT-AD-6C8091588860','CAT-AD-5BC25E34DC80']) {
    const d = loadCatalog(); d[0].find(p => p.id === id).phone='02-581';
    assert.match(inspectCatalog(...d).join('\n'), /First source phone corrupted/);
  }
});
