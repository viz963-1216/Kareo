import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCloudTarget} from '../../scripts/verify-cloud-retention.mjs';

test('rejects another site/project/person, absent credentials and unconfirmed writes before cloud imports',()=>{
  const valid={KAREO_CLOUD_RETENTION_CONFIRM:'true',SUPABASE_URL:'https://ojawadobnaxduxybqolk.supabase.co',
    NETLIFY_SITE_ID:'faeb21e1-94d1-4d42-bbbc-6f9692caaef9',KAREO_OPERATOR_ID:'OP-SU-ZIJIE-ACCEPTANCE',
    SUPABASE_SERVICE_ROLE_KEY:'synthetic',NETLIFY_AUTH_TOKEN:'synthetic',KAREO_OPERATOR_KEY:'synthetic'};
  assert.doesNotThrow(()=>assertCloudTarget(valid));
  for(const changed of [{KAREO_CLOUD_RETENTION_CONFIRM:'false'}, {SUPABASE_URL:'https://vcbhtlwkzavqvxthicis.supabase.co'},
    {NETLIFY_SITE_ID:'another-site'}, {KAREO_OPERATOR_ID:'another-person'},
    {SUPABASE_SERVICE_ROLE_KEY:''}, {NETLIFY_AUTH_TOKEN:''}, {KAREO_OPERATOR_KEY:''},
    {SUPABASE_URL:valid.SUPABASE_URL+'?redirect=other'}])assert.throws(()=>assertCloudTarget({...valid,...changed}));
});
