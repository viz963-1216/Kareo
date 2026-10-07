import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceProbeHtml,PROBE_BRANCH} from '../../scripts/lib/acceptance-session-probe.mjs';

test('deployment-only diagnostic cannot be emitted into production, PR previews, local or unrelated branch builds',()=>{
  const valid={CONTEXT:'branch-deploy',BRANCH:PROBE_BRANCH,COMMIT_REF:'a'.repeat(40),SUPABASE_SERVICE_ROLE_KEY:'PRIVATE-SYNTHETIC',NETLIFY_AUTH_TOKEN:'PRIVATE-SYNTHETIC'};
  const html=acceptanceProbeHtml(valid);assert.ok(html.includes('a'.repeat(40)));assert.ok(!html.includes('PRIVATE-SYNTHETIC'));
  for(const changed of [{CONTEXT:'production'},{CONTEXT:'deploy-preview'},{CONTEXT:'local'},{BRANCH:'main'},{BRANCH:'staging'},{BRANCH:'another'},{COMMIT_REF:'invalid'}])assert.equal(acceptanceProbeHtml({...valid,...changed}),null);
});
