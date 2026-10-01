// C-006 Mock acceptance: login, token isolation, review confirmation, publish preview and withdrawal warning.
// Usage: (cd apps/web && npx vite --port 5173) then node apps/web/acceptance/c-006/capture.mjs apps/web/acceptance/c-006
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const BASE = "http://localhost:5173";
const PORT = 9500 + Math.floor(Math.random() * 300);
mkdirSync(OUT, { recursive: true });

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "c006-"))}`,
  "--no-first-run", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ws;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((target) => target.type === "page");
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* Chrome is still starting. */ }
  await sleep(200);
}
if (!ws) throw new Error("Chrome debugging target did not start");
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
  else request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  pending.set(requestId, { method, resolve, reject });
  ws.send(JSON.stringify({ id: requestId, method, params }));
});
const run = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};

const report = { generatedAt: new Date().toISOString(), base: BASE, mode: "mock (vite dev)", scope: "C-006 admin knowledge review and release controls", viewports: {}, scenarios: {} };

async function shot(viewport, name, checks) {
  const { contentSize } = await send("Page.getLayoutMetrics");
  const height = Math.min(Math.ceil(contentSize.height), 5000);
  const { data } = await send("Page.captureScreenshot", {
    format: "jpeg", quality: 75, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: viewport.width, height, scale: 1 },
  });
  const file = `${viewport.name}-${name}.jpg`;
  writeFileSync(join(OUT, file), Buffer.from(data, "base64"));
  report.viewports[viewport.name].shots.push({ file, ...checks });
}

async function flow(viewport) {
  report.viewports[viewport.name] = { width: viewport.width, height: viewport.height, shots: [] };
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 768,
  });
  await send("Page.navigate", { url: `${BASE}/admin/knowledge` });
  await sleep(300);
  await run(`sessionStorage.clear(); location.reload();`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await run(`return document.querySelectorAll('input').length === 2;`)) break;
    await sleep(100);
  }
  const loginChecks = await run(`
    const text = document.body.innerText;
    return {
      noindex: document.querySelector('meta[name=robots]')?.content,
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      managementDataHidden: !text.includes('KB-MOCK-001') && !text.includes('測試用地方補助紀錄'),
      adminNavLinkCount: document.querySelectorAll('header a[href="/admin/knowledge"]').length,
      localStorage: JSON.stringify(localStorage),
      sessionStorageBeforeLogin: JSON.stringify(sessionStorage),
    };
  `);
  await shot(viewport, "01-login", loginChecks);
  const keyboardOrder = await run(`
    const fields = document.querySelectorAll('input');
    fields[0].focus();
    return { first: document.activeElement?.autocomplete };
  `);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  keyboardOrder.second = await run(`return document.activeElement?.autocomplete;`);
  await run(`
    const fields = document.querySelectorAll('input');
    const set = (element, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); };
    set(fields[0], 'jerry'); set(fields[1], 'mock-key'); document.querySelector('form button').click();
  `);
  await sleep(1300);
  const dashboardChecks = await run(`
    const text = document.body.innerText;
    return {
      noindex: document.querySelector('meta[name=robots]')?.content,
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      hasStatus: text.includes('KB-MOCK-001') && text.includes('每日檢查'),
      hasChanges: text.includes('收費方式'),
      hasRecords: text.includes('測試用地方補助紀錄'),
      writeButtonCount: [...document.querySelectorAll('button')].filter(button => /核准|退回|發布|撤回|不影響內容/.test(button.innerText)).length,
      hasPublishPreview: text.includes('發布預覽') && text.includes('KB-MOCK-002'),
      hasWithdrawalWarning: text.includes('使用者評估將暫停'),
      publishInitiallyDisabled: [...document.querySelectorAll('button')].find(button => button.innerText.includes('確認發布'))?.disabled,
      officialLinkSafe: [...document.querySelectorAll('main a[target=_blank]')].every(link => link.rel.includes('noreferrer')),
      localStorage: JSON.stringify(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
      urlHasCredential: /jerry|mock-key|ADMIN-TOKEN/.test(location.href),
      overflow: [...document.querySelectorAll('body *')].filter(element => element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
    };
  `);
  await shot(viewport, "02-dashboard", { ...dashboardChecks, keyboardOrder });
  await run(`
    [...document.querySelectorAll('button')].find(button => button.innerText === '核准').click();
  `);
  await sleep(100);
  const reviewChecks = await run(`
    const panel = document.querySelector('.admin-confirm');
    const submit = panel?.querySelector('button[type=submit]');
    return {
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth,
      hasReasonLimit: panel?.querySelector('textarea')?.maxLength === 500,
      hasExplicitConfirmation: Boolean(panel?.querySelector('input[type=checkbox]')),
      submitInitiallyDisabled: submit?.disabled,
      text: panel?.innerText.includes('確認管理操作'),
    };
  `);
  await shot(viewport, "03-review-confirmation", reviewChecks);
  const required = loginChecks.noindex === "noindex, nofollow"
    && loginChecks.noHorizontalScroll && loginChecks.managementDataHidden && loginChecks.adminNavLinkCount === 0
    && dashboardChecks.noHorizontalScroll && dashboardChecks.hasStatus && dashboardChecks.hasChanges && dashboardChecks.hasRecords
    && dashboardChecks.writeButtonCount >= 5 && dashboardChecks.hasPublishPreview && dashboardChecks.hasWithdrawalWarning
    && dashboardChecks.publishInitiallyDisabled && dashboardChecks.officialLinkSafe && !dashboardChecks.urlHasCredential
    && JSON.stringify(dashboardChecks.sessionStorageKeys) === JSON.stringify(["kareo.adminToken"])
    && keyboardOrder.first === "username" && keyboardOrder.second === "current-password"
    && reviewChecks.noHorizontalScroll && reviewChecks.hasReasonLimit && reviewChecks.hasExplicitConfirmation
    && reviewChecks.submitInitiallyDisabled && reviewChecks.text;
  if (!required) throw new Error(`${viewport.name}: C-006 acceptance failed ${JSON.stringify({ loginChecks, dashboardChecks, keyboardOrder, reviewChecks })}`);
}

async function scenarioLogin(name) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${BASE}/admin/knowledge?adminMock=${name}` });
  await sleep(250);
  await run(`sessionStorage.clear(); location.reload();`);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (await run(`return document.querySelectorAll('.admin-login input').length === 2;`)) break;
    await sleep(100);
  }
  await run(`
    const fields = document.querySelectorAll('.admin-login input');
    const set = (element, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); };
    set(fields[0], 'jerry'); set(fields[1], 'mock-key'); document.querySelector('.admin-login form button').click();
  `);
  await sleep(1700);
}

async function scenarioShot(name, checks) {
  const { contentSize } = await send("Page.getLayoutMetrics");
  const { data } = await send("Page.captureScreenshot", {
    format: "jpeg", quality: 75, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1280, height: Math.min(Math.ceil(contentSize.height), 5000), scale: 1 },
  });
  const file = `desktop-scenario-${name}.jpg`;
  writeFileSync(join(OUT, file), Buffer.from(data, "base64"));
  report.scenarios[name] = { file, ...checks };
  if (!checks.pass) throw new Error(`${name}: scenario acceptance failed ${JSON.stringify(checks)}`);
}

async function scenarioFlows() {
  for (const name of ["empty", "session-invalid", "forbidden", "publish-blocked", "no-current"]) {
    await scenarioLogin(name);
    const checks = await run(`
      const text = document.body.innerText;
      const select = document.querySelector('#knowledge-withdraw-title')?.parentElement.querySelector('select');
      return {
        noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth,
        noindex: document.querySelector('meta[name=robots]')?.content,
        pass: ${JSON.stringify(name)} === 'empty' ? text.includes('目前沒有待檢視的每日變更') && text.includes('目前沒有待核准紀錄') && select?.options.length === 1
          : ${JSON.stringify(name)} === 'session-invalid' ? text.includes('登入已失效') && Boolean(document.querySelector('.admin-login'))
          : ${JSON.stringify(name)} === 'forbidden' ? text.includes('沒有管理權限') && text.includes('此操作者沒有知識發布權限')
          : ${JSON.stringify(name)} === 'publish-blocked' ? text.includes('目前沒有已核准、可發布的紀錄') && [...document.querySelectorAll('button')].find(button => button.innerText.includes('確認發布'))?.disabled
          : text.includes('目前沒有可撤回的已發布版本') && select?.disabled,
      };
    `);
    checks.pass = Boolean(checks.pass && checks.noHorizontalScroll && checks.noindex === "noindex, nofollow");
    await scenarioShot(name, checks);
  }

  for (const name of ["validation-error", "state-changed"]) {
    await scenarioLogin(name);
    await run(`return [...document.querySelectorAll('button')].find(button => button.innerText === '核准').click();`);
    await sleep(100);
    await run(`
      const panel = document.querySelector('.admin-confirm');
      const textarea = panel.querySelector('textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, '已核對官方來源'); textarea.dispatchEvent(new Event('input', { bubbles: true }));
      panel.querySelector('input[type=checkbox]').click();
      const submit = panel.querySelector('button[type=submit]'); submit.click(); submit.click();
    `);
    await sleep(1800);
    const checks = await run(`
      const text = document.body.innerText;
      return { noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth,
        pass: ${JSON.stringify(name)} === 'validation-error' ? text.includes('請填寫原因') : text.includes('資料狀態已更新') && !document.querySelector('.admin-confirm') };
    `);
    checks.pass = Boolean(checks.pass && checks.noHorizontalScroll);
    await scenarioShot(name, checks);
  }

  await scenarioLogin("restore-unavailable");
  await run(`
    const publish = document.querySelector('#knowledge-publish-title').parentElement;
    publish.querySelector('input[type=checkbox]').click(); publish.querySelector('button[type=submit]').click();
  `);
  await sleep(1800);
  await run(`
    const section = document.querySelector('#knowledge-withdraw-title').parentElement;
    const select = section.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'KB-MOCK-001'); select.dispatchEvent(new Event('change', { bubbles: true }));
    const textarea = section.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, '恢復版本驗收'); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    section.querySelector('input[type=checkbox]').click(); section.querySelector('button[type=submit]').click();
  `);
  await sleep(1800);
  const restoreChecks = await run(`const text = document.body.innerText; return { noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth, selectionCleared: document.querySelector('#knowledge-withdraw-title')?.parentElement.querySelector('select')?.value === '', pass: text.includes('版本狀態已改變') };`);
  restoreChecks.pass = Boolean(restoreChecks.pass && restoreChecks.noHorizontalScroll && restoreChecks.selectionCleared);
  await scenarioShot("restore-unavailable", restoreChecks);
}

try {
  await flow({ name: "desktop", width: 1280, height: 900 });
  await flow({ name: "tablet", width: 768, height: 1024 });
  await flow({ name: "mobile", width: 375, height: 812 });
  await scenarioFlows();
  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  rmSync(join(OUT, "capture-error.log"), { force: true });
  console.log("ok 17 shots");
} catch (error) {
  writeFileSync(join(OUT, "capture-error.log"), `${error?.stack ?? error}\n`);
  throw error;
} finally {
  ws.close();
  chrome.kill();
}
