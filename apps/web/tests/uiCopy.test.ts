// C-005 guard rails on UI source (not on API text, which is shown verbatim):
//  - no "nearest/nearby" or "approved" claims (PRODUCT_SPEC §22/§24/§33, API_CONTRACT §9);
//  - no policy amounts or percentages written into the frontend (ASSESSMENT_RULES §6.4);
//  - UI code never imports the mock adapter or fixtures statically (real bundles must stay mock-free);
//  - nothing sensitive goes to console or localStorage.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../src/", import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const sources = files(root).map((path) => ({ path: path.slice(root.length), code: withoutComments(readFileSync(path, "utf8")) }));
const ui = sources.filter(({ path }) => path.endsWith(".tsx"));

test("UI copy never claims nearest/nearby or approved status", () => {
  for (const { path, code } of ui) {
    for (const word of ["最近", "附近", "已核定", "您可獲得", "確定符合", "媒合完成", "已接單"]) {
      const allowed = word === "媒合完成" && /不代表媒合已完成/.test(code);
      assert.ok(!code.includes(word) || allowed, `${path} contains "${word}"`);
    }
  }
});

test("no policy amounts or rates are written into the frontend", () => {
  for (const { path, code } of sources) {
    assert.doesNotMatch(code, /\d{1,3}(,\d{3})+\s*元/, `${path} contains a money amount`);
    assert.doesNotMatch(code, /["'`>][^"'`<]*\d+(\.\d+)?\s*%/, `${path} contains a percentage in text`);
  }
});

test("mock adapter and fixtures are only reachable through the lazy import in src/api", () => {
  for (const { path, code } of sources) {
    if (path.startsWith("api/")) continue;
    assert.doesNotMatch(code, /from\s+["'][^"']*(mockAdapter|recommendationMockFixtures|contracts\/mock)/, path);
  }
  const index = sources.find(({ path }) => path === "api/index.ts")!.code;
  assert.doesNotMatch(index, /^import\s+(?!type)[^;]*mockAdapter/m, "api/index.ts must import the mock adapter lazily");
});

test("no console logging of data and no localStorage", () => {
  for (const { path, code } of sources) {
    assert.ok(!code.includes("localStorage"), `${path} uses localStorage`);
    if (path === "api/index.ts" || path === "api/realAdapter.ts") continue; // existing J-003 config warnings only
    assert.doesNotMatch(code, /console\.(log|info|debug|warn|error)/, path);
  }
});
