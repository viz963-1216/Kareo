import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptancePublicProbeHtml} from '../../scripts/lib/acceptance-public-probe.mjs';
import {runPublicProbe} from '../../scripts/lib/acceptance-public-probe-client.mjs';

const expectedCommit='a'.repeat(40),baseUrl='https://abc--kareo-tw.netlify.app';
const version={commit:expectedCommit,deployId:'deploy-a',branch:'fix/j-003-staging-smoke-safety-oct06',context:'branch-deploy'};
function response(body,status=200,type='application/json'){return new Response(JSON.stringify(body),{status,headers:{'content-type':type}});}
function fixture({markerOverride,changedAfter=false,unknownHtml=false}={}){
  const requests=[];let markers=0;
  const fetchImpl=async(path,options)=>{
    requests.push({path,options});
    if(path==='/kareo-version.json')return response({...version,...markerOverride,...(++markers===2&&changedAfter?{deployId:'deploy-b'}:{})});
    if(path==='/api/v1/e2e-unknown-endpoint')return response({success:false,error:{code:'NOT_FOUND'}},404,unknownHtml?'text/html':'application/json');
    if(path==='/api/v1/providers')return response({success:true,data:{items:[{id:'PUBLIC-1'}],total:35}});
    if(path==='/api/v1/knowledge/records')return response({success:true,data:{items:[],total:21,knowledgeVersion:'KB-2026-09-24-001'}});
    throw new Error('Unexpected request');
  };return {requests,fetchImpl};
}
test('private GET probe requires before/after exact deployment and never writes or authenticates a Session',async()=>{
  const {requests,fetchImpl}=fixture();
  const report=await runPublicProbe({expectedCommit,baseUrl,fetchImpl});
  assert.equal(report.deployment.matches,true);
  assert.deepEqual(report.results.map(r=>[r.caseId,r.status]),[['E2E-21','PASS'],['E2E-44','PENDING'],['E2E-48','PENDING']]);
  assert.equal(requests.length,5);
  for(const {path,options} of requests){
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(options.credentials,'same-origin');assert.equal(options.body,undefined);
    assert.deepEqual(Object.keys(options.headers),['Accept']);
    assert.ok(!/session|consent|assessment|lead|admin/.test(path));
  }
});
test('wrong deployment stops at marker; changed after-version cannot leave a countable PASS',async()=>{
  for(const markerOverride of [{commit:'b'.repeat(40)},{context:'production'},{branch:'staging'}]){
    const {fetchImpl,requests}=fixture({markerOverride});
    const report=await runPublicProbe({expectedCommit,baseUrl,fetchImpl});
    assert.equal(report.status,'STOPPED');assert.deepEqual(report.results,[]);assert.equal(requests.length,1);
  }
  const {fetchImpl}=fixture({changedAfter:true});
  const report=await runPublicProbe({expectedCommit,baseUrl,fetchImpl});
  assert.equal(report.deployment.matches,false);assert.deepEqual(report.results,[]);
});
test('login HTML and request errors fail closed without writing arbitrary exception contents',async()=>{
  const html=await runPublicProbe({expectedCommit,baseUrl,fetchImpl:async()=>new Response('login',{status:401,headers:{'content-type':'text/html'}})});
  assert.equal(html.failure,'NON_JSON_RESPONSE');assert.deepEqual(html.results,[]);
  const report=await runPublicProbe({expectedCommit,baseUrl,fetchImpl:async()=>{throw new Error('private-token-do-not-log');}});
  assert.equal(report.failure,'REQUEST_FAILED');assert.ok(!JSON.stringify(report).includes('private-token'));
  const {fetchImpl}=fixture({unknownHtml:true});
  assert.deepEqual((await runPublicProbe({expectedCommit,baseUrl,fetchImpl})).results,[]);
});
test('public probe assets are exclusive to the preauthorized private branch deployment',()=>{
  const env={CONTEXT:'branch-deploy',BRANCH:version.branch,COMMIT_REF:expectedCommit};
  assert.ok(acceptancePublicProbeHtml(env).includes('/__acceptance-public-probe.mjs'));
  for(const override of [{CONTEXT:'production'},{CONTEXT:'deploy-preview'},{CONTEXT:'local'},{BRANCH:'other'},{COMMIT_REF:'bad'}])assert.equal(acceptancePublicProbeHtml({...env,...override}),null);
});
