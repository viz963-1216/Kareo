// Public GETs only, in the existing authorized browser/platform access context.
// Do not accept URLs, headers, tokens, request bodies or methods from the page.
export async function runPublicProbe({expectedCommit,baseUrl,fetchImpl=fetch}){
  const startedAt=new Date().toISOString();
  const report={schemaVersion:2,runId:`browser-public-${startedAt}`,apiMode:'real',baseUrl,
    commit:expectedCommit,startedAt,operator:'Kareo private browser public GET probe',results:[],diagnostics:[]};
  const get=async(path)=>{
    const response=await fetchImpl(path,{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('NON_JSON_RESPONSE');
    return {status:response.status,body:await response.json()};
  };
  const marker=async()=>{
    const response=await get('/kareo-version.json');
    const m=response.body;
    if(response.status!==200||!/^[a-f0-9]{40}$/.test(m?.commit??'')||typeof m.deployId!=='string'||!m.deployId)throw new Error('INVALID_VERSION_MARKER');
    return {versionUrl:baseUrl+'/kareo-version.json',fetchedAt:new Date().toISOString(),httpStatus:200,
      commit:m.commit,context:m.context,branch:m.branch,deployId:m.deployId,commitSource:m.commitSource,builtAt:m.builtAt};
  };
  const requirePrivate=(m)=>{
    if(m.commit!==expectedCommit||m.branch!=='fix/j-003-staging-smoke-safety-oct06'||m.context!=='branch-deploy')throw new Error('WRONG_DEPLOYMENT');
  };
  let before=null,after=null;
  try{
    if(!/^[a-f0-9]{40}$/.test(expectedCommit)||!/^https:\/\/[a-z0-9-]+--kareo-tw\.netlify\.app$/.test(baseUrl))throw new Error('WRONG_SITE_OR_COMMIT');
    before=await marker();requirePrivate(before);
    const unknown=await get('/api/v1/e2e-unknown-endpoint');
    report.results.push({caseId:'E2E-21',status:unknown.status===404&&unknown.body?.success===false&&unknown.body?.error?.code==='NOT_FOUND'?'PASS':'FAIL',evidence:`Unknown API HTTP ${unknown.status}; JSON NOT_FOUND ${unknown.body?.error?.code==='NOT_FOUND'?'present':'absent'}`});
    for(const [caseId,path,knowledge] of [['E2E-44','/api/v1/providers',false],['E2E-48','/api/v1/knowledge/records',true]]){
      const response=await get(path),data=response.body?.data;
      const unavailable=[401,403,503].includes(response.status);
      const valid=response.status===200&&response.body?.success===true&&Array.isArray(data?.items)&&(!knowledge||/^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(data.knowledgeVersion??''));
      report.results.push({caseId,status:valid||unavailable?'PENDING':'FAIL',evidence:`${path}: HTTP ${response.status}; ${valid?'list envelope valid; full UI/filter/error/no-session acceptance pending':'list unavailable or invalid'}`});
      if(valid)report.diagnostics.push({path,items:data.items.length,total:data.total??null,...(knowledge?{knowledgeVersion:data.knowledgeVersion}:{})});
    }
    after=await marker();requirePrivate(after);
    if(after.deployId!==before.deployId)throw new Error('DEPLOYMENT_CHANGED');
    report.status=report.results.some(r=>r.status==='FAIL')?'FAIL':'PASS_PARTIAL_GET_ONLY';
  }catch(error){
    // Never expose arbitrary response/exception text (including credentials).
    report.status='STOPPED';report.failure=['NON_JSON_RESPONSE','INVALID_VERSION_MARKER','WRONG_DEPLOYMENT','WRONG_SITE_OR_COMMIT','DEPLOYMENT_CHANGED'].includes(error?.message)?error.message:'REQUEST_FAILED';
    report.results=[];
  }
  report.deployment={method:'kareo-version.json',targetCommit:expectedCommit,before,after,matches:before?.commit===expectedCommit&&after?.commit===expectedCommit&&before?.deployId===after?.deployId};
  report.finishedAt=new Date().toISOString();
  return report;
}

if(typeof document!=='undefined'){
  const button=document.querySelector('#run'),output=document.querySelector('#result');
  button.addEventListener('click',async()=>{
    button.disabled=true;output.textContent='檢查中；只讀取公開資料。';
    output.textContent=JSON.stringify(await runPublicProbe({expectedCommit:document.body.dataset.commit,baseUrl:location.origin}),null,2);
  });
}
