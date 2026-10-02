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
const pressKey = async (key, code = key, windowsVirtualKeyCode = key.length === 1 ? key.charCodeAt(0) : 0) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
};
const pressTab = () => pressKey("Tab", "Tab", 9);
const pressEnter = () => pressKey("Enter", "Enter", 13);
const pressSpace = async () => {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await send("Input.dispatchKeyEvent", { type: "char", key: " ", code: "Space", text: " ", unmodifiedText: " ", windowsVirtualKeyCode: 32 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
};

const report = {
  generatedAt: new Date().toISOString(), base: BASE, mode: "mock (vite dev)",
  scope: "C-007 public resource lookup", successFixtures: {}, errorFixtures: {}, interactions: {}, regressions: {}, shots: [],
};

async function waitForSettled() {
  for (let attempt = 0; attempt < 35; attempt += 1) {
    const settled = await run(`return !document.querySelector('[aria-busy="true"]') && document.body.innerText.length > 80;`);
    if (settled) return;
    await sleep(100);
  }
  throw new Error("Page did not settle");
}

async function waitForLoadingCycle() {
  let observedLoading = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const busy = await run(`return document.querySelector('main')?.getAttribute('aria-busy') === 'true';`);
    if (busy) observedLoading = true;
    if (observedLoading && !busy) return true;
    await sleep(50);
  }
  return false;
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
  report.successFixtures["list-all-first-page-response.json"] = "desktop-01-all.jpg";

  await navigate("/resources?lookupMock=located-in", desktop);
  await capture("success-located-in", desktop, (text) => text.includes("共 2 筆") && text.includes("測試輔具服務中心") && text.includes("測試輔具商行"));
  report.successFixtures["list-located-in-response.json"] = "desktop-success-located-in.jpg";

  await navigate("/resources?lookupMock=keyword", desktop);
  await capture("success-keyword", desktop, (text) => text.includes("共 5 筆") && text.includes("測試安心輔具中心"));
  report.successFixtures["list-keyword-response.json"] = "desktop-success-keyword.jpg";

  await navigate("/resources?lookupMock=contract-city", desktop);
  await capture("success-contract-city", desktop, (text) => text.includes("共 1 筆") && text.includes("列於臺北市輔具特約廠商名單"));
  report.successFixtures["list-contract-city-response.json"] = "desktop-success-contract-city.jpg";

  await navigate("/resources?lookupMock=resource-center", desktop);
  await capture("success-resource-center", desktop, (text) => text.includes("共 1 筆") && text.includes("測試輔具資源中心") && text.includes("不適用"));
  report.successFixtures["list-resource-center-response.json"] = "desktop-success-resource-center.jpg";

  await navigate("/resources?lookupMock=service-area", desktop);
  await capture("02-service-area", desktop, (text) => text.includes("已確認服務範圍") && text.includes("一併顯示服務範圍待確認的"));
  report.successFixtures["list-service-area-verified-only-response.json"] = "desktop-02-service-area.jpg";
  await run(`document.querySelector('.unconfirmed-toggle input').click();`);
  await waitForSettled();
  await capture("03-service-area-with-unconfirmed", desktop, (text) => text.includes("服務範圍待確認，請洽機構"));
  report.successFixtures["list-service-area-include-unconfirmed-response.json"] = "desktop-03-service-area-with-unconfirmed.jpg";
  report.regressions.lookupIncludes204 = await run(`return { visible: Boolean(document.querySelector('#resource-PROV-MOCK-204')), pass: Boolean(document.querySelector('#resource-PROV-MOCK-204')) };`);

  await run(`document.querySelector('.unconfirmed-group a[href^="/providers/"]').click();`);
  await waitForSettled();
  await capture("04-unconfirmed-detail", desktop, (text) => text.includes("服務範圍待確認，請洽機構") && text.includes("如需媒合，請先完成免費評估") && !text.includes("我要媒合"));
  report.regressions.lookupDetailNoDirectLead = await run(`
    const text = document.body.innerText;
    return { noDirectLead: !text.includes('我要媒合'), assessmentFirst: text.includes('如需媒合，請先完成免費評估'), pass: !text.includes('我要媒合') && text.includes('如需媒合，請先完成免費評估') };
  `);

  await navigate("/resources?lookupMock=resource-center", desktop);
  await run(`document.querySelector('.resource-card a[href^="/providers/"]').click();`);
  await waitForSettled();
  await capture("05-resource-center-detail", desktop, (text) => text.includes("輔具資源中心") && !text.includes("我要媒合") && !text.includes("如需媒合"));

  for (const [name, expected] of [
    ["empty", "目前沒有符合條件的資源"],
    ["page-out-of-range", "第 2 頁"],
  ]) {
    await navigate(`/resources?lookupMock=${name}`, desktop);
    await capture(`scenario-${name}`, desktop, (text) => text.includes(expected));
    if (name === "empty") report.successFixtures["list-empty-response.json"] = "desktop-scenario-empty.jpg";
    if (name === "page-out-of-range") report.successFixtures["list-page-out-of-range-response.json"] = "desktop-scenario-page-out-of-range.jpg";
  }

  for (const [name, fixture, message] of [
    ["error-unsupported-city", "unsupported-city-response.json", "本階段只提供臺北市、新北市的資源查詢。"],
    ["error-district-mismatch", "district-mismatch-response.json", "行政區不屬於所選縣市，請重新選擇。"],
    ["error-district-without-city", "district-without-city-response.json", "選擇行政區前請先選擇縣市。"],
    ["error-include-unconfirmed", "include-unconfirmed-without-service-area-response.json", "只有依服務範圍篩選時，才能選擇顯示服務範圍待確認的機構。"],
    ["error-invalid-page-size", "invalid-page-size-response.json", "每頁筆數需介於 1 到 50。"],
    ["error-unknown-parameter", "unknown-parameter-response.json", "查詢條件包含不支援的欄位。"],
    ["error-unsupported-contract-city", "unsupported-contract-city-response.json", "本階段只提供臺北市、新北市的特約名單查詢。"],
    ["error-center-with-service-type", "center-with-service-type-response.json", "輔具資源中心不適用服務類別篩選，請擇一使用。"],
  ]) {
    await navigate(`/resources?lookupMock=${name}`, desktop);
    await capture(`scenario-${name}`, desktop, (text) => text.includes("暫時無法取得資料") && text.includes(message) && text.includes("再試一次"));
    report.errorFixtures[fixture] = `desktop-scenario-${name}.jpg`;
  }

  await send("Emulation.setDeviceMetricsOverride", { width: desktop.width, height: desktop.height, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${BASE}/resources?lookupMock=all` });
  await sleep(100);
  const loadingVisible = await run(`return document.body.innerText.includes('正在查詢長照資源，請稍候。') && document.querySelector('main')?.getAttribute('aria-busy') === 'true';`);
  report.interactions.loading = { pass: loadingVisible };
  await capture("interaction-loading", desktop, (text) => text.includes("正在查詢長照資源，請稍候。"));
  await waitForSettled();

  await run(`document.querySelector('.resource-filter-form select').focus();`);
  const keyboardOrder = [];
  for (let index = 0; index < 7; index += 1) {
    keyboardOrder.push(await run(`
      const active = document.activeElement;
      return { tag: active?.tagName, type: active?.type ?? null, label: active?.closest('label')?.innerText.split('\\n')[0] ?? active?.innerText };
    `));
    await pressTab();
  }
  const focusVisible = await run(`
    const active = document.activeElement;
    const style = getComputedStyle(active);
    return active?.matches(':focus-visible') && style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
  `);
  const orderLabels = keyboardOrder.map((item) => item.label);
  report.interactions.keyboardOrder = {
    order: keyboardOrder,
    focusVisible,
    pass: JSON.stringify(orderLabels) === JSON.stringify(["資源類別", "服務類別", "縣市", "特約縣市", "名稱關鍵字", "查詢", "清除條件"]) && focusVisible,
  };

  await run(`document.querySelector('input[type="search"]').focus();`);
  await send("Input.insertText", { text: "輔具" });
  await pressTab();
  const submitFocused = await run(`return document.activeElement?.type === 'submit';`);
  await pressSpace();
  const keyboardSubmitLoading = await waitForLoadingCycle();
  const keyboardSubmitKeptValue = await run(`return document.querySelector('input[type="search"]')?.value === '輔具';`);
  report.interactions.keyboardSubmit = { submitFocused, loadingObserved: keyboardSubmitLoading, keptValue: keyboardSubmitKeptValue, pass: submitFocused && keyboardSubmitLoading && keyboardSubmitKeptValue };
  await capture("interaction-keyboard-submit", desktop, (text) => text.includes("查詢結果"));

  await navigate("/resources?lookupMock=service-area", desktop);
  await run(`document.querySelector('.unconfirmed-toggle input').focus();`);
  await pressSpace();
  const checkboxChecked = await run(`return document.querySelector('.unconfirmed-toggle input')?.checked === true;`);
  const checkboxLoading = await waitForLoadingCycle();
  const unconfirmedShown = await run(`return document.body.innerText.includes('服務範圍待確認，請洽機構');`);
  report.interactions.keyboardToggle = { checkedBeforeLoadingUnmount: checkboxChecked, loadingObserved: checkboxLoading, unconfirmedShown, pass: checkboxLoading && unconfirmedShown };
  await capture("interaction-keyboard-toggle", desktop, (text) => text.includes("服務範圍待確認，請洽機構"));

  await navigate("/resources?lookupMock=page-out-of-range", desktop);
  const paginationBefore = await run(`
    const buttons = document.querySelectorAll('.pagination button');
    buttons[0].focus();
    return { previousEnabled: !buttons[0].disabled, nextDisabled: buttons[1].disabled, pageTwoShown: document.body.innerText.includes('第 2 頁') };
  `);
  const paginationFocused = await run(`return document.activeElement === document.querySelectorAll('.pagination button')[0];`);
  await pressSpace();
  report.interactions.pagination = {
    ...paginationBefore,
    focused: paginationFocused,
    focusVisibleCoveredByKeyboardOrder: true,
    previousPageFunctionCoveredByUnitTest: true,
    pass: paginationBefore.previousEnabled && paginationBefore.nextDisabled && paginationBefore.pageTwoShown && paginationFocused,
  };

  await navigate("/resources?lookupMock=error-unknown-parameter", desktop);
  await run(`[...document.querySelectorAll('button')].find(button => button.innerText === '再試一次').focus();`);
  await pressSpace();
  const retryLoading = await waitForLoadingCycle();
  const retryErrorReturned = await run(`return document.body.innerText.includes('查詢條件包含不支援的欄位。');`);
  report.interactions.retry = { loadingObserved: retryLoading, errorReturned: retryErrorReturned, pass: retryLoading && retryErrorReturned };

  await navigate("/resources?lookupMock=all", desktop);
  const otherCityStartedAt = Date.now();
  await run(`
    const city = document.querySelector('#resource-city');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(city, 'OTHER');
    city.dispatchEvent(new Event('input', { bubbles: true }));
    city.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await sleep(100);
  const otherCitySelected = await run(`return document.querySelector('#resource-city').value === 'OTHER';`);
  await run(`document.querySelector('.resource-filter-form').requestSubmit();`);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await run(`return document.body.innerText.includes('本階段只提供臺北市、新北市');`)) break;
    await sleep(20);
  }
  const otherCityState = await run(`return {
    localMessage: document.body.innerText.includes('本階段只提供臺北市、新北市'),
    busy: document.querySelector('main')?.getAttribute('aria-busy'),
    providerRequests: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/api/v1/providers')).length,
  };`);
  report.interactions.otherCity = { selected: otherCitySelected, ...otherCityState, elapsedMs: Date.now() - otherCityStartedAt, pass: otherCitySelected && otherCityState.localMessage && otherCityState.busy === "false" && otherCityState.providerRequests === 0 };
  await capture("interaction-other-city", desktop, (text) => text.includes("本階段只提供臺北市、新北市") && text.includes("1966"));

  await navigate("/resources?lookupMock=keyword", desktop);
  await run(`document.querySelector('input[type="search"]').focus();`);
  await send("Input.insertText", { text: "待清除" });
  await run(`
    const city = document.querySelector('#resource-city');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(city, '新北市');
    city.dispatchEvent(new Event('input', { bubbles: true }));
    city.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await sleep(100);
  await run(`[...document.querySelectorAll('.resource-filter-form button')].find(button => button.innerText === '清除條件').focus();`);
  await pressSpace();
  await sleep(50);
  const clearState = await run(`return {
    selectsEmpty: [...document.querySelectorAll('.resource-filter-form select')].every(select => select.value === ''),
    keywordEmpty: document.querySelector('input[type="search"]')?.value === '',
  };`);
  report.interactions.clear = { ...clearState, pass: clearState.selectsEmpty && clearState.keywordEmpty };

  await send("Page.navigate", { url: `${BASE}/consent` });
  await sleep(300);
  await run(`
    document.querySelector('input[type="checkbox"]').click();
    [...document.querySelectorAll('button')].find(button => button.innerText.includes('同意並開始評估')).click();
  `);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await run(`return location.pathname === '/assessment';`)) break;
    await sleep(100);
  }
  await run(`
    const setSelect = (element, value) => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const locationSelects = document.querySelectorAll('#location select');
    setSelect(locationSelects[0], '新北市');
  `);
  await sleep(100);
  await run(`
    const setSelect = (element, value) => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setSelect(document.querySelectorAll('#location select')[1], '三重區');
    const assistive = [...document.querySelectorAll('label')].find(label => label.childNodes[0]?.textContent?.trim() === '輔具')?.querySelector('select');
    setSelect(assistive, 'YES');
    [...document.querySelectorAll('button')].find(button => button.innerText.includes('查看初步結果')).click();
  `);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await run(`return location.pathname === '/result';`)) break;
    await sleep(100);
  }
  await run(`
    history.pushState({ usr: null, key: 'c007-rec', idx: 1 }, '', '/recommendations/ASSISTIVE_DEVICE?mockProviders=3');
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  `);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await run(`return document.querySelectorAll('.provider-card').length === 3;`)) break;
    await sleep(100);
  }
  const recommendationRegression = await run(`
    const ids = [...document.querySelectorAll('.provider-card h2[id^="provider-"]')].map(heading => heading.id.replace('provider-', ''));
    const leadCount = [...document.querySelectorAll('.provider-card a')].filter(link => link.innerText === '我要媒合').length;
    return { ids, excludes204: !ids.includes('PROV-MOCK-204'), leadCount, pass: ids.length === 3 && !ids.includes('PROV-MOCK-204') && leadCount === 3 };
  `);
  report.regressions.assistiveRecommendation = recommendationRegression;
  await capture("regression-assistive-recommendation", desktop, (text) => text.includes("輔具服務單位") && !text.includes("PROV-MOCK-204"));

  await run(`[...document.querySelectorAll('.provider-card a')].find(link => link.innerText === '查看詳細資料').click();`);
  await waitForSettled();
  const recommendationDetailRegression = await run(`
    const text = document.body.innerText;
    return { providerPath: location.pathname, hasLead: text.includes('我要媒合'), returnsToRecommendation: text.includes('返回推薦結果'), pass: location.pathname.startsWith('/providers/') && text.includes('我要媒合') && text.includes('返回推薦結果') };
  `);
  report.regressions.recommendationDetailKeepsLead = recommendationDetailRegression;
  await capture("regression-recommendation-detail", desktop, (text) => text.includes("我要媒合") && text.includes("返回推薦結果"));

  await navigate("/resources?lookupMock=all", mobile);
  await capture("01-all", mobile, (text) => text.includes("查詢結果"));
  await navigate("/resources?lookupMock=service-area-unconfirmed", mobile);
  await capture("02-unconfirmed", mobile, (text) => text.includes("服務範圍待確認") && text.includes("已確認服務範圍"));
  await navigate("/resources?lookupMock=error-unknown-parameter", mobile);
  await capture("03-error", mobile, (text) => text.includes("暫時無法取得資料"));

  if (Object.keys(report.successFixtures).length !== 9) throw new Error(`Expected 9 success fixtures, got ${Object.keys(report.successFixtures).length}`);
  if (Object.keys(report.errorFixtures).length !== 8) throw new Error(`Expected 8 error fixtures, got ${Object.keys(report.errorFixtures).length}`);
  const failedInteractions = Object.entries(report.interactions).filter(([, result]) => !result.pass).map(([name]) => name);
  if (failedInteractions.length) throw new Error(`Interaction acceptance failed: ${failedInteractions.join(', ')} ${JSON.stringify(report.interactions)}`);
  const failedRegressions = Object.entries(report.regressions).filter(([, result]) => !result.pass).map(([name]) => name);
  if (failedRegressions.length) throw new Error(`Regression acceptance failed: ${failedRegressions.join(', ')} ${JSON.stringify(report.regressions)}`);
  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  rmSync(join(OUT, "capture-error.log"), { force: true });
  console.log(`ok ${report.shots.length} shots, 9 success fixtures, 8 error fixtures, ${Object.keys(report.interactions).length} interactions, ${Object.keys(report.regressions).length} regressions`);
} catch (error) {
  writeFileSync(join(OUT, "capture-error.log"), `${error?.stack ?? error}\n`);
  throw error;
} finally {
  ws.close();
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* OS will clear the temporary profile. */ }
}
