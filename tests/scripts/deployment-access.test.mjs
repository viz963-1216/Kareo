import test from 'node:test';
import assert from 'node:assert/strict';
import {observeDeployment,deploymentEvidence} from '../e2e/deployment-evidence.mjs';
// Use the shared target parser's representation, rather than guessed properties.
import {resolveReleaseTarget} from '../../scripts/lib/release-target.mjs';
const target=resolveReleaseTarget(['--base-url=https://example.test','--commit='+'a'.repeat(40)],{});

test('protected preview HTML is access blocked, never a build failure or counted deployment',async()=>{
 for(const status of [401,403]) {
  const r=await observeDeployment(target.env,async()=>new Response('<html>private-login-value</html>',{status}));
  assert.equal(r.httpStatus,status);assert.equal(r.commit,null);
  assert.match(r.error,/access is protected/);assert.doesNotMatch(r.error,/private-login-value|not deployed/);
  assert.equal(deploymentEvidence(r,r,target.commit).matches,false);
 }
});
test('an unauthorized response carrying a matching JSON marker still cannot count',async()=>{
 const r=await observeDeployment(target.env,async()=>new Response(JSON.stringify({commit:target.commit}),{status:401}));
 assert.equal(r.commit,null);assert.equal(deploymentEvidence(r,r,target.commit).matches,false);
});
test('server error remains server error even when the body is not JSON',async()=>{
 const r=await observeDeployment(target.env,async()=>new Response('<html>service unavailable</html>',{status:503}));
 assert.equal(r.error,'version marker HTTP 503');assert.equal(r.commit,null);
});
test('only successful full markers on both observations count as matching',async()=>{
 const r=await observeDeployment(target.env,async()=>new Response(JSON.stringify({commit:target.commit}),{status:200}));
 assert.equal(r.commit,target.commit);assert.equal(deploymentEvidence(r,r,target.commit).matches,true);
 assert.equal(deploymentEvidence(r,null,target.commit).matches,false);
 const html=await observeDeployment(target.env,async()=>new Response('<html>SPA</html>',{status:200}));
 assert.equal(html.commit,null);assert.equal(deploymentEvidence(html,html,target.commit).matches,false);
});
