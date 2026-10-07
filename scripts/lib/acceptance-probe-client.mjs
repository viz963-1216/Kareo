// This asset is emitted only in the already approved private acceptance branch.
// The visitor token lives in this function's memory only; never in DOM/storage/logs.
const button=document.querySelector('#run'),output=document.querySelector('#result');
button.addEventListener('click',async()=>{
  button.disabled=true;
  const report={scope:'DEPLOYED_NO_HEALTH_SESSION_CHECK_NOT_FULL_49_E2E',expectedCommit:document.body.dataset.commit,
    startedAt:new Date().toISOString(),status:'RUNNING',checks:[]};
  let token='';
  const show=()=>{output.textContent=JSON.stringify(report,null,2);};
  const require=(condition,label)=>{if(!condition)throw new Error(label);};
  const request=async(path,options={})=>{
    const response=await fetch(path,{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(30000),...options});
    require(response.headers.get('content-type')?.includes('application/json'),'NON_JSON_RESPONSE');
    return {status:response.status,body:await response.json()};
  };
  try{
    require(location.protocol==='https:'&&location.hostname.endsWith('--kareo-tw.netlify.app'),'WRONG_SITE');
    const before=await request('/kareo-version.json');
    require(before.status===200&&before.body.commit===report.expectedCommit&&before.body.branch==='fix/j-003-staging-smoke-safety-oct06'&&before.body.context==='branch-deploy','WRONG_DEPLOYMENT');
    report.markerBefore=before.body;report.checks.push('EXACT_DEPLOYMENT_BEFORE_WRITES');show();
    const created=await request('/api/v1/session',{method:'POST'});
    require(created.status===200&&created.body.success===true,'CREATE_SESSION_FAILED');
    const data=created.body.data;
    // Preserve only a non-secret fixture reference even if a later check fails.
    if(typeof data?.sessionId==='string')report.syntheticSessionId=data.sessionId;
    require(typeof data?.sessionId==='string'&&/^SES-[A-Z0-9]+$/.test(data.sessionId),'INVALID_SESSION_ID');
    require(typeof data.sessionToken==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.sessionToken),'INVALID_TOKEN');
    token=data.sessionToken;
    require(Number.isFinite(Date.parse(data.createdAt))&&Date.parse(data.createdAt)<=Date.now()+5000&&Date.parse(data.expiresAt)>Date.now(),'INVALID_SESSION_TIMES');
    report.createdAt=data.createdAt;report.expiresAt=data.expiresAt;report.checks.push('REAL_SESSION_CREATED_TOKEN_SHAPE_AND_EXPIRY');show();
    const deleted=await request('/api/v1/session',{method:'DELETE',headers:{'X-Kareo-Session-Token':token}});
    require(deleted.status===200&&deleted.body.success===true&&deleted.body.data?.sessionId===report.syntheticSessionId&&deleted.body.data.status==='DELETION_REQUESTED','DELETE_SESSION_FAILED');
    const deadline=Date.parse(deleted.body.data.deletionScheduledBefore);
    require(Number.isFinite(deadline)&&deadline>Date.now()&&deadline<=Date.now()+7*86400000+5000,'INVALID_DELETE_DEADLINE');
    report.deletionScheduledBefore=deleted.body.data.deletionScheduledBefore;report.checks.push('REAL_DEPLOYED_DELETE_ACCEPTED_WITH_DEADLINE');show();
    const repeat=await request('/api/v1/session',{method:'DELETE',headers:{'X-Kareo-Session-Token':token}});
    require(repeat.status===401&&repeat.body.success===false&&repeat.body.error?.code==='SESSION_INVALID','DELETED_TOKEN_NOT_INVALIDATED');
    report.checks.push('DELETED_TOKEN_REJECTED');token='';
    const after=await request('/kareo-version.json');
    require(after.status===200&&after.body.commit===report.expectedCommit&&after.body.deployId===before.body.deployId,'DEPLOYMENT_CHANGED');
    report.markerAfter=after.body;report.checks.push('EXACT_DEPLOYMENT_AFTER_WRITES');report.status='PASS';
  }catch(error){report.status='STOPPED';report.failure=error?.message??'CHECK_FAILED';}
  finally{token='';report.finishedAt=new Date().toISOString();show();}
});
