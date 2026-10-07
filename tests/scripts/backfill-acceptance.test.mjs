import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTarget, rowsDigest, assertPreserved} from '../../scripts/backfill-acceptance.mjs';

test('reject another database or operator before loading the database client', () => {
  const valid = {SUPABASE_URL:'https://ojawadobnaxduxybqolk.supabase.co', KAREO_OPERATOR_ID:'OP-SU-ZIJIE-ACCEPTANCE', SUPABASE_SERVICE_ROLE_KEY:'synthetic', KAREO_OPERATOR_KEY:'synthetic'};
  assert.doesNotThrow(() => assertTarget(valid));
  for (const altered of [{SUPABASE_URL:'https://vcbhtlwkzavqvxthicis.supabase.co'}, {KAREO_OPERATOR_ID:'another-person'}, {KAREO_OPERATOR_KEY:''}, {SUPABASE_URL:valid.SUPABASE_URL+'?host=another'}]) {
    assert.throws(() => assertTarget({...valid,...altered}));
  }
});
test('detect changed policy bytes, state or membership despite the same row count', () => {
  const original=[{id:'one',summary:'approved',status:'PUBLISHED'}];
  const fixed = names => Object.fromEntries(names.map(n=>[n,{count:1,digest:rowsDigest(original)}]));
  const names=['knowledge_records','knowledge_versions','knowledge_version_records'];
  const before=fixed(names);
  assert.doesNotThrow(()=>assertPreserved(before,fixed(names)));
  for (const name of names) {
    const after=fixed(names); after[name].digest=rowsDigest([{...original[0],summary:'altered'}]);
    assert.throws(()=>assertPreserved(before,after));
  }
});
test('digest ignores response ordering but preserves content and array ordering', () => {
  assert.equal(rowsDigest([{b:2,a:1},{id:'second'}]),rowsDigest([{id:'second'},{a:1,b:2}]));
  assert.notEqual(rowsDigest([{rules:[1,2]}]),rowsDigest([{rules:[2,1]}]));
});
