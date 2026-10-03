import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const BASE = "http://127.0.0.1:5174";
const PORT = 9900 + Math.floor(Math.random() * 80);
mkdirSync(OUT, { recursive: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "c009-"))}`,
  "--no-first-run", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
for (let i = 0; i < 50; i += 1) {
  try { const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const page = targets.find((target) => target.type === "page"); if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; } } catch { /* starting */ }
  await sleep(200);
}
if (!ws) throw new Error("Chrome did not start");
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener("message", (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const request = pending.get(message.id); pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); });
const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); ws.send(JSON.stringify({ id: requestId, method, params })); });
const run = async (expression) => { const result = await send("Runtime.evaluate", { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const report = { generatedAt: new Date().toISOString(), mode: "mock (vite dev)", fixtures: {}, interactions: {}, shots: [] };
const helper = `
  window.btn = (text) => [...document.querySelectorAll('button,a')].find(node => node.innerText.trim().startsWith(text));
  window.setSelect = (element, value) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('change', { bubbles: true })); };
  window.go = (path) => { history.pushState({ usr: null, key: Math.random().toString(), idx: 1 }, '', path); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); };
`;
async function shot(file) {
  const metrics = await send("Page.getLayoutMetrics"); const width = Math.ceil(metrics.contentSize.width); const height = Math.min(Math.ceil(metrics.contentSize.height), 6000);
  const capture = await send("Page.captureScreenshot", { format: "jpeg", quality: 72, captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(join(OUT, file), Buffer.from(capture.data, "base64"));
  const checks = await run(`return { noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth, iframes: document.querySelectorAll('iframe').length };`);
  report.shots.push({ file, ...checks }); if (!checks.noHorizontalScroll || checks.iframes) throw new Error(`${file}: viewport failed`);
}
async function prepare(disability, income) {
  await send("Page.navigate", { url: `${BASE}/consent` });
  for (let i = 0; i < 40; i += 1) { await sleep(100); if (await run(`return Boolean(document.querySelector('input[type=checkbox]'));`)) break; }
  await run(helper);
  await run(`document.querySelector('input[type=checkbox]').click(); btn('同意並開始評估').click();`); await sleep(1100);
  await run(`
    const location = document.querySelectorAll('#location select'); setSelect(location[0], '新北市'); await new Promise(r=>setTimeout(r,80));
    setSelect(document.querySelectorAll('#location select')[1], '三重區');
    setSelect(document.querySelector('select[aria-describedby="disability-certificate-hint"]'), ${JSON.stringify(disability)});
    setSelect(document.querySelector('select[aria-describedby="income-category-hint"]'), ${JSON.stringify(income)});
    await new Promise(r=>setTimeout(r,80)); btn('查看初步結果').click();
  `); await sleep(1300);
  const before = await run(`return performance.getEntriesByType('resource').length;`);
  await run(`btn('產生給個管師').click();`); await sleep(150);
  const after = await run(`return performance.getEntriesByType('resource').length;`);
  return { before, after };
}

try {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const [name, disability, income, phrase] of [
    ["subsidy", "UNKNOWN", "UNKNOWN", "交通接送服務"],
    ["disability", "YES", "UNKNOWN", "身心障礙福利補助"],
    ["estimate-general", "YES", "GENERAL", "一般戶"],
  ]) {
    const network = await prepare(disability, income);
    const checks = await run(`
      const summary = document.querySelector('.case-manager-summary'); const text = summary?.innerText ?? '';
      return { pass: Boolean(summary) && text.includes(${JSON.stringify(phrase)}) && text.includes('本摘要為初步預估') && text.includes('建議詢問 1966') && !/姓名：|電話：|地址：|座標：/.test(text), networkBefore: ${network.before}, networkAfter: ${network.after} };
    `);
    checks.pass = checks.pass && checks.networkBefore === checks.networkAfter;
    if (!checks.pass) throw new Error(`${name}: fixture acceptance failed ${JSON.stringify(checks)}`);
    const file = `desktop-${name}.jpg`; report.fixtures[name] = { file, ...checks }; await shot(file);
  }

  await run(`
    window.__copied = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copied = value; } } });
    window.__printed = 0; window.print = () => { window.__printed += 1; };
    btn('複製文字').click(); await new Promise(r=>setTimeout(r,50)); btn('列印摘要').click();
  `);
  report.interactions.copyPrint = await run(`return { pass: window.__copied.includes('給個管師／1966 的需求摘要') && window.__copied.includes('知識版本：KB-MOCK-001') && window.__printed === 1, copiedLength: window.__copied.length, printCalls: window.__printed };`);
  await run(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }); btn('複製文字').click(); await new Promise(r=>setTimeout(r,50));`);
  report.interactions.copyFailure = await run(`return { pass: document.querySelector('[role=alert]')?.innerText.includes('手動選取') === true };`);
  if (!report.interactions.copyPrint.pass || !report.interactions.copyFailure.pass) throw new Error("copy/print checks failed");
  await shot("desktop-copy-failure.jpg");

  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await shot("mobile-summary.jpg"); report.interactions.mobile = { pass: true };
  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`ok ${report.shots.length} shots, ${Object.keys(report.fixtures).length} fixtures, ${Object.keys(report.interactions).length} interactions`);
} catch (error) {
  writeFileSync(join(OUT, "capture-error.log"), `${error?.stack ?? error}\n`); throw error;
} finally { ws?.close(); chrome.kill("SIGTERM"); }
