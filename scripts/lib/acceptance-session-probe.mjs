export const PROBE_BRANCH='fix/j-003-staging-smoke-safety-oct06';
export function acceptanceProbeHtml(env){
  if(env.CONTEXT!=='branch-deploy'||env.BRANCH!==PROBE_BRANCH||!/^[a-f0-9]{40}$/.test(env.COMMIT_REF??''))return null;
  // Only a public build SHA is inserted. No credentials or deployment env dump.
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kareo 私人驗收檢查</title><body data-commit="${env.COMMIT_REF}"><main><h1>Kareo 私人驗收：空白 Session 刪除</h1><p>僅供既有私人驗收分支。檢查實際部署版本，建立一筆不含健康或聯絡資料的 Session，再要求刪除。不會送出同意、評估或媒合資料。</p><button id="run">執行空白 Session 檢查</button><pre id="result" role="status" aria-live="polite">尚未執行</pre></main><script type="module" src="/__acceptance-session-probe.mjs"></script></body></html>`;
}
