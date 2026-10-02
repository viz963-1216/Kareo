// C-007 Mock acceptance: public resource lookup, unconfirmed split, detail isolation and RWD.
// Usage: (cd apps/web && npx vite --port 5173) then node apps/web/acceptance/c-007/capture.mjs apps/web/acceptance/c-007
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const BASE = "http://localhost:5173";
const PORT = 9800 + Math.floor(Math.random() * 150);
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "c007-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
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

const report = {
  generatedAt: new Date().toISOString(), base: BASE, mode: "mock (vite dev)",
  scope: "C-007 public resource lookup", shots: [],
};

async function waitForSettled() {
  for (let attempt = 0; attempt < 35; attempt += 1) {
    const settled = await run(`return !document.querySelector('[aria-busy="true"]') && document.body.innerText.length > 80;`);
    if (settled) return;
    await sleep(100);
  }
  throw new Error("Page did not settle");
}

async function capture(name, viewport, expectation) {
  const checks = await run(`
    const text = document.body.innerText;
    const forbidden = ['為您推薦', '最近', '附近', '適合您', '一定可到府'];
    return {
      title: document.querySelector('main h1')?.innerText,
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      nearWords: forbidden.some(word => text.includes(word)),
      iframes: document.querySelectorAll('iframe').length,
      unsafeBlankLinks: [...document.querySelectorAll('a[target="_blank"]')].filter(link => !link.rel.includes('noopener') || !link.rel.includes('noreferrer')).length,
      text,
    };
  `);
  const pass = checks.noHorizontalScroll && !checks.nearWords && checks.iframes === 0
    && checks.unsafeBlankLinks === 0 && expectation(checks.text);
  const { contentSize } = await send("Page.getLayoutMetrics");
  const { data } = await send("Page.captureScreenshot", {
    format: "jpeg", quality: 78, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(Math.ceil(contentSize.height), 5000), scale: 1 },
  });
  const file = `${viewport.name}-${name}.jpg`;
  writeFileSync(join(OUT, file), Buffer.from(data, "base64"));
  report.shots.push({ file, ...checks, text: undefined, pass });
  if (!pass) throw new Error(`${file}: ${JSON.stringify({ ...checks, text: checks.text.slice(0, 800) })}`);
}

async function navigate(path, viewport) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 768,
  });
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitForSettled();
}

const desktop = { name: "desktop", width: 1280, height: 900 };
const mobile = { name: "mobile", width: 375, height: 812 };

try {
  await navigate("/resources?lookupMock=all", desktop);
  await capture("01-all", desktop, (text) => text.includes("查詢長照資源") && text.includes("查詢結果"));

  await navigate("/resources?lookupMock=service-area", desktop);
  await capture("02-service-area", desktop, (text) => text.includes("已確認服務範圍") && text.includes("一併顯示服務範圍待確認的"));
  await run(`document.querySelector('.unconfirmed-toggle input').click();`);
  await waitForSettled();
  await capture("03-service-area-with-unconfirmed", desktop, (text) => text.includes("服務範圍待確認，請洽機構"));

  await run(`document.querySelector('.unconfirmed-group a[href^="/providers/"]').click();`);
  await waitForSettled();
  await capture("04-unconfirmed-detail", desktop, (text) => text.includes("服務範圍待確認，請洽機構") && text.includes("如需媒合，請先完成免費評估") && !text.includes("我要媒合"));

  await navigate("/resources?lookupMock=resource-center", desktop);
  await run(`document.querySelector('.resource-card a[href^="/providers/"]').click();`);
  await waitForSettled();
  await capture("05-resource-center-detail", desktop, (text) => text.includes("輔具資源中心") && !text.includes("我要媒合") && !text.includes("如需媒合"));

  for (const [name, expected] of [
    ["empty", "目前沒有符合條件的資源"],
    ["page-out-of-range", "第 2 頁"],
    ["error-unsupported-city", "暫時無法取得資料"],
    ["error-district-mismatch", "暫時無法取得資料"],
    ["error-center-with-service-type", "暫時無法取得資料"],
  ]) {
    await navigate(`/resources?lookupMock=${name}`, desktop);
    await capture(`scenario-${name}`, desktop, (text) => text.includes(expected));
  }

  await navigate("/resources?lookupMock=all", mobile);
  await capture("01-all", mobile, (text) => text.includes("查詢結果"));
  await navigate("/resources?lookupMock=service-area-unconfirmed", mobile);
  await capture("02-unconfirmed", mobile, (text) => text.includes("服務範圍待確認") && text.includes("已確認服務範圍"));
  await navigate("/resources?lookupMock=error-unknown-parameter", mobile);
  await capture("03-error", mobile, (text) => text.includes("暫時無法取得資料"));

  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  rmSync(join(OUT, "capture-error.log"), { force: true });
  console.log(`ok ${report.shots.length} shots`);
} catch (error) {
  writeFileSync(join(OUT, "capture-error.log"), `${error?.stack ?? error}\n`);
  throw error;
} finally {
  ws.close();
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* OS will clear the temporary profile. */ }
}
