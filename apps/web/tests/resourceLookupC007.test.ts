import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isProviderDetail, isResourceLookupResponse } from "../src/api/realAdapter.ts";

const src = fileURLToPath(new URL("../src/", import.meta.url));
const fixtures = fileURLToPath(new URL("../../../contracts/mock/providers/", import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path));

test("all nine resource lookup success fixtures satisfy the real API response validator", () => {
  const lookup = `${fixtures}lookup/`;
  const files = readdirSync(lookup).filter((name) => name.endsWith("-response.json"));
  assert.equal(files.length, 9);
  for (const file of files) {
    const envelope = json(`${lookup}${file}`);
    assert.equal(envelope.success, true, file);
    assert.equal(isResourceLookupResponse(envelope.data), true, file);
  }
});

test("both C-007 provider details satisfy strict validation", () => {
  for (const file of ["PROV-MOCK-204.json", "PROV-MOCK-301.json"]) {
    const envelope = json(`${fixtures}${file}`);
    assert.equal(envelope.success, true, file);
    assert.equal(isProviderDetail(envelope.data), true, file);
  }
});

test("mock lookup exposes every success, empty, page and contracted error screen", () => {
  const scenarios = read(`${src}api/mockScenarios.ts`);
  const adapter = read(`${src}api/mockAdapter.ts`);
  const requiredScenarios = [
    "all", "located-in", "service-area", "service-area-unconfirmed", "keyword",
    "contract-city", "resource-center", "empty", "page-out-of-range",
    "error-unsupported-city", "error-district-mismatch", "error-district-without-city",
    "error-include-unconfirmed", "error-invalid-page-size", "error-unknown-parameter",
    "error-unsupported-contract-city", "error-center-with-service-type",
  ];
  for (const scenario of requiredScenarios) assert.match(scenarios, new RegExp(`"${scenario}"`));

  const errorFiles = readdirSync(`${fixtures}lookup/errors/`).filter((name) => name.endsWith("-response.json"));
  assert.equal(errorFiles.length, 8);
  for (const file of errorFiles) assert.match(adapter, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("resource lookup renders API notices and keeps unconfirmed results separate", () => {
  const page = read(`${src}pages/ResourceLookupPage.tsx`);
  assert.match(page, /state\.response\.notice/);
  assert.match(page, /state\.response\.unconfirmedCount/);
  assert.match(page, /includeUnconfirmed/);
  assert.match(page, /已確認服務範圍/);
  assert.match(page, /服務範圍待確認，請洽機構/);
  assert.match(page, /本階段只提供臺北市、新北市/);
  for (const forbidden of ["為您推薦", "最近", "附近", "適合您", "一定可到府"]) {
    assert.doesNotMatch(page, new RegExp(forbidden), forbidden);
  }
});

test("resource-origin detail never exposes Lead and resource centers never expose matching", () => {
  const page = read(`${src}pages/ProviderDetailPage.tsx`);
  assert.match(page, /location\.state\?\.source === "resource-lookup"/);
  assert.match(page, /!fromResourceLookup && provider\.resourceCategory !== "ASSISTIVE_DEVICE_CENTER" && leadSelection/);
  assert.match(page, /fromResourceLookup && provider\.resourceCategory !== "ASSISTIVE_DEVICE_CENTER"/);
  assert.match(page, /如需媒合，請先完成免費評估/);
  assert.match(page, /to="\/consent"/);
  assert.match(page, /返回查詢結果/);
  assert.match(page, /長照輔具補助須向核定縣市的特約廠商購置；特約名單不代表能到府或服務您所在的行政區。/);
});

test("resource lookup response validation rejects leaked internal fields and malformed counts", () => {
  const valid = json(`${fixtures}lookup/list-all-first-page-response.json`).data;
  assert.equal(isResourceLookupResponse({ ...valid, internalScore: 1 }), false);
  assert.equal(isResourceLookupResponse({ ...valid, page: 0 }), false);
  assert.equal(isResourceLookupResponse({ ...valid, totalCount: -1 }), false);
  assert.equal(isResourceLookupResponse({ ...valid, unconfirmedCount: -1 }), false);
  assert.equal(isResourceLookupResponse({ ...valid, items: [{ ...valid.items[0], internalScore: 1 }] }), false);
});
