import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const BASE = "http://127.0.0.1:5173";
const PORT = 9800 + Math.floor(Math.random() * 100);
mkdirSync(OUT, { recursive: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "c008-"))}`,
  "--no-first-run", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
for (let i = 0; i < 50; i += 1) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((target) => target.type === "page");
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* Chrome is starting. */ }
  await sleep(200);
}
if (!ws) throw new Error("Chrome did not start");
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id); pending.delete(message.id);
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id; pending.set(requestId, { resolve, reject }); ws.send(JSON.stringify({ id: requestId, method, params }));
});
const run = async (expression) => {
  const result = await send("Runtime.evaluate", { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const scenarios = [
  "first-page", "second-page", "taipei", "new-taipei-assistive-device", "empty",
  "invalid-jurisdiction", "invalid-category", "unknown-parameter", "knowledge-unavailable",
];
const report = { generatedAt: new Date().toISOString(), mode: "mock (vite dev)", scenarios: {}, interactions: {}, shots: [] };

async function navigate(path, width = 1280, height = 900) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Page.navigate", { url: `${BASE}${path}` });
  for (let i = 0; i < 40; i += 1) {
    await sleep(100);
    if (await run(`return Boolean(document.querySelector('.knowledge-card, .empty-state, [role=alert]'));`)) return;
  }
  throw new Error(`timeout: ${path}`);
}

async function shot(file, extra = {}) {
  const metrics = await send("Page.getLayoutMetrics");
  const width = Math.ceil(metrics.contentSize.width);
  const height = Math.min(Math.ceil(metrics.contentSize.height), 6000);
  const capture = await send("Page.captureScreenshot", { format: "jpeg", quality: 72, captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(join(OUT, file), Buffer.from(capture.data, "base64"));
  const checks = await run(`return { noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth, iframes: document.querySelectorAll('iframe').length, h1: document.querySelector('h1')?.innerText };`);
  report.shots.push({ file, ...checks, ...extra });
  if (!checks.noHorizontalScroll || checks.iframes !== 0) throw new Error(`${file}: viewport check failed`);
}

try {
  for (const scenario of scenarios) {
    await navigate(`/info?knowledgeMock=${scenario}`);
    const checks = await run(`
      const text = document.body.innerText;
      const expected = ${JSON.stringify(scenario)};
      const pass = expected === 'empty' ? text.includes('目前沒有符合條件的資訊')
        : expected === 'knowledge-unavailable' ? text.includes('目前沒有可用的已發布資訊') && !text.includes('KREC-MOCK')
        : expected.startsWith('invalid-') || expected === 'unknown-parameter' ? Boolean(document.querySelector('[role=alert]'))
        : document.querySelectorAll('.knowledge-card').length > 0;
      return { pass, cards: document.querySelectorAll('.knowledge-card').length };
    `);
    if (!checks.pass) {
      const body = await run(`return document.body.innerText;`);
      throw new Error(`${scenario}: scenario failed\n${body}`);
    }
    const file = `desktop-${scenario}.jpg`;
    report.scenarios[scenario] = { file, ...checks };
    await shot(file, { scenario });
  }

  await navigate("/info?knowledgeMock=new-taipei-assistive-device");
  report.interactions.nullSource = await run(`
    const title = '新北市政府身心障礙者輔具費用補助基準（新北市加碼）';
    const card = [...document.querySelectorAll('.knowledge-card')].find(node => node.innerText.includes(title));
    return { pass: Boolean(card) && ![...card.querySelectorAll('a')].some(anchor => anchor.innerText.includes(title)) };
  `);
  await run(`document.querySelector('.knowledge-filter select').focus();`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  report.interactions.keyboard = await run(`return { pass: document.activeElement === document.querySelectorAll('.knowledge-filter select')[1] && getComputedStyle(document.activeElement).outlineStyle !== 'none' };`);
  if (!report.interactions.nullSource.pass || !report.interactions.keyboard.pass) throw new Error("interaction checks failed");
  await shot("desktop-interactions.jpg");

  await navigate("/info?knowledgeMock=new-taipei-assistive-device", 375, 812);
  await shot("mobile-new-taipei-assistive-device.jpg");
  report.interactions.mobile = { pass: true };
  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`ok ${report.shots.length} shots, ${Object.keys(report.scenarios).length} scenarios, ${Object.keys(report.interactions).length} interactions`);
} catch (error) {
  writeFileSync(join(OUT, "capture-error.log"), `${error?.stack ?? error}\n`);
  throw error;
} finally {
  ws?.close(); chrome.kill("SIGTERM");
}
