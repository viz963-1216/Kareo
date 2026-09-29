// C-006 Mock acceptance: login, token isolation, review confirmation, publish preview and withdrawal warning.
// Usage: (cd apps/web && npx vite --port 5173) then node apps/web/acceptance/c-006/capture.mjs apps/web/acceptance/c-006
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

const report = { generatedAt: new Date().toISOString(), base: BASE, mode: "mock (vite dev)", scope: "C-006 admin knowledge review and release controls", viewports: {} };

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
      writeButtonCount: [...document.querySelectorAll('button')].filter(button => /核准|拒絕|發布|撤回|忽略/.test(button.innerText)).length,
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

try {
  await flow({ name: "desktop", width: 1280, height: 900 });
  await flow({ name: "tablet", width: 768, height: 1024 });
  await flow({ name: "mobile", width: 375, height: 812 });
  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log("ok 9 shots");
} catch (error) {
  writeFileSync(join(OUT, "capture-error.log"), `${error?.stack ?? error}\n`);
  throw error;
} finally {
  ws.close();
  chrome.kill();
}
