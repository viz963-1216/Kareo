import {acceptanceProbeHtml} from './acceptance-session-probe.mjs';

export function acceptancePublicProbeHtml(env){
  if(!acceptanceProbeHtml(env))return null;
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kareo 私人公開 API 驗收</title><body data-commit="${env.COMMIT_REF}"><main><h1>Kareo 私人驗收：公開查詢 API</h1><p>使用既有登入存取檢查實際部署版本及公開 GET API。不建立 Session，不送出同意、評估、媒合或管理操作。查詢成功不代表完整 UI 案例通過。</p><button id="run">執行公開 GET 檢查</button><pre id="result" role="status" aria-live="polite">尚未執行</pre></main><script type="module" src="/__acceptance-public-probe.mjs"></script></body></html>`;
}
