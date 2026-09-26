// C-005 Mock acceptance evidence: drives headless Chrome over CDP (no dependencies) against the Vite dev
// server in mock mode and writes screenshots + a JSON report.
// Usage: (cd apps/web && npx vite --port 5173) then node apps/web/acceptance/c-005/capture.mjs apps/web/acceptance/c-005
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const BASE = "http://localhost:5173";
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "c005-"))}`,
  "--no-first-run", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 50; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === "page");
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* not up yet */ }
  await sleep(200);
}
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const run = async (expression) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

const report = { generatedAt: new Date().toISOString(), base: BASE, mode: "mock (vite dev)", viewports: {} };

const helpers = `
  window.w = (ms) => new Promise(r => setTimeout(r, ms));
  window.go = (p) => { history.pushState({ usr: history.state?.usr ?? null, key: 'k' + Math.random(), idx: 1 }, '', p); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); };
  window.goWithState = (p) => { history.pushState({ ...history.state, key: 'k' + Math.random() }, '', p); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); };
  window.btn = (t) => [...document.querySelectorAll('button, a')].find(b => b.innerText.trim().startsWith(t));
  window.setSel = (el, v) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
  window.setInput = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.geo = (mode) => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok, fail) => setTimeout(() => mode === 'ok' ? ok({ coords: { latitude: 25.0617, longitude: 121.4866 } }) : fail({ code: mode === 'timeout' ? 3 : 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }), 200) } });
`;

async function shot(vp, name, checks = {}) {
  await sleep(150);
  const { contentSize } = await send("Page.getLayoutMetrics");
  const height = Math.min(Math.ceil(contentSize.height), 6000);
  const { data } = await send("Page.captureScreenshot", {
    format: "jpeg", quality: 70, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: vp.width, height, scale: 1 },
  });
  const file = `${vp.name}-${name}.jpg`;
  writeFileSync(join(OUT, file), Buffer.from(data, "base64"));
  const page = await run(`return { path: location.pathname + location.search, h1: document.querySelector('main h1')?.innerText, noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth, nearWords: /最近|附近/.test(document.body.innerText), iframes: document.querySelectorAll('iframe').length };`);
  report.viewports[vp.name].shots.push({ file, ...page, ...checks });
}

async function flow(vp, full) {
  report.viewports[vp.name] = { width: vp.width, height: vp.height, shots: [] };
  await send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.width < 768 });
  await send("Page.navigate", { url: `${BASE}/` });
  await sleep(1500);
  await run(helpers);
  if (full) await shot(vp, "00-home");
  await run(`go('/consent'); await w(300);`);
  await shot(vp, "01-consent", await run(`return { consentPrechecked: document.querySelector('input[type=checkbox]').checked };`));
  await run(`document.querySelector('input[type=checkbox]').click(); await w(50); btn('同意並開始評估').click(); await w(1200);`);

  // No location → result without recommendations
  await run(`btn('查看初步結果').click(); await w(1300);`);
  await shot(vp, "02-result-no-location");
  if (full) {
    await run(`go('/recommendations/HOME_CARE'); await w(400);`);
    await shot(vp, "03-rec-no-location-not-called");
  }

  // GPS denied → still completes with district
  await run(`geo('denied'); go('/assessment'); await w(300); const [c, d] = document.querySelectorAll('#location select'); setSel(c, '新北市'); await w(50); setSel(document.querySelectorAll('#location select')[1], '三重區'); await w(50); btn('使用目前位置').click(); await w(100); document.querySelector('.location-notice').scrollIntoView();`);
  await shot(vp, "04-location-notice");
  await run(`btn('我了解').click(); await w(600); document.querySelector('.gps-box').scrollIntoView();`);
  await shot(vp, "05-gps-denied");
  await run(`btn('查看初步結果').click(); await w(1300);`);
  await shot(vp, "06-result-subsidy-district");

  const recs = full
    ? [["07-rec-district-3", "mockProviders=3"], ["08-rec-district-1", "mockProviders=1"], ["09-rec-district-2", "mockProviders=2"], ["10-rec-empty-0", "mockProviders=0"],
       ["11-rec-distance-3", "mockProviders=3&mockRanking=distance"], ["12-rec-missing-coordinates", "mockProviders=3&mockRanking=missing-coordinates"],
       ["13-rec-city-rotation", "mockProviders=3&mockRanking=city"], ["14-rec-error", "mockState=error"], ["15-rec-session-expired", "mockState=session-expired"]]
    : [["11-rec-distance-3", "mockProviders=3&mockRanking=distance"], ["10-rec-empty-0", "mockProviders=0"]];
  for (const [name, query] of recs) {
    await run(`go('/recommendations/HOME_CARE?${query}'); await w(1300);`);
    await shot(vp, name, await run(`return { cards: document.querySelectorAll('.provider-card').length, distanceShown: document.body.innerText.includes('公里') };`));
  }

  if (full) {
    await run(`go('/recommendations/HOME_CARE?mockProviders=3'); await w(1300); btn('查看詳細資料').click(); await w(1200);`);
    await shot(vp, "16-provider-detail", await run(`return { externalLinks: [...document.querySelectorAll('main a[target=_blank]')].map(a => a.rel) };`));
  }

  // Lead
  await run(`go('/recommendations/HOME_CARE?mockProviders=3'); await w(1300); btn('我要媒合').click(); await w(300); goWithState('/match?mockState=error-once'); await w(200); document.querySelector('.lead-form button').click(); await w(200);`);
  await shot(vp, "17-lead-validation", await run(`return { focused: document.activeElement.name };`));
  if (full) {
    // Keyboard order through the form
    const order = [];
    await run(`document.querySelector('input[name=name]').focus();`);
    for (let i = 0; i < 3; i++) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      order.push(await run(`const e = document.activeElement; return e.name || e.type || e.tagName;`));
    }
    report.viewports[vp.name].leadTabOrder = ["name", ...order];
  }
  const leadCounts = await run(`
    const url = performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/src/api/mockAdapter.ts')); const m = await import(url); const before = m.mockApi.leadRequestCount();
    setInput(document.querySelector('input[name=name]'), '王先生'); setInput(document.querySelector('input[name=phone]'), '0912-345-678'); await w(50);
    document.querySelector('.lead-form input[type=checkbox]').click(); await w(50);
    const b = document.querySelector('.lead-form button'); b.click(); b.click(); b.click(); await w(1400);
    return { requestsFromTripleClick: m.mockApi.leadRequestCount() - before, keptName: document.querySelector('input[name=name]')?.value };`);
  await shot(vp, "18-lead-failed-kept-input", leadCounts);
  await run(`document.querySelector('.lead-form button').click(); await w(1400);`);
  await shot(vp, "19-lead-success", await run(`return { localStorage: JSON.stringify(localStorage), urlHasPhone: location.href.includes('0912') };`));

  // GPS success → DISTANCE
  if (full) {
    await run(`geo('ok'); go('/assessment'); await w(300); btn('使用目前位置').click(); await w(50); btn('我了解').click(); await w(600); document.querySelector('.gps-box').scrollIntoView();`);
    await shot(vp, "20-gps-success");
    await run(`btn('查看初步結果').click(); await w(1300); go('/recommendations/HOME_CARE?mockProviders=3'); await w(1300);`);
    await shot(vp, "21-rec-after-gps-distance", await run(`return { explanation: document.querySelector('.recommendation-notice p').innerText };`));
    await run(`go('/result?mockState=error-once'); await w(300); btn('刪除我的評估資料').click(); await w(50); btn('確定刪除').click(); await w(900); document.querySelector('[role=alert]').scrollIntoView();`);
    await shot(vp, "22-delete-failed-not-deleted");
    await run(`btn('刪除我的評估資料').click(); await w(50); btn('確定刪除').click(); await w(900);`);
    await shot(vp, "23-session-deleted");
  }
}

try {
  await flow({ name: "desktop", width: 1280, height: 900 }, true);
  await flow({ name: "tablet", width: 768, height: 1024 }, false);
  await flow({ name: "mobile", width: 375, height: 812 }, false);
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("ok", Object.values(report.viewports).reduce((n, v) => n + v.shots.length, 0), "shots");
} finally {
  ws.close();
  chrome.kill();
}
