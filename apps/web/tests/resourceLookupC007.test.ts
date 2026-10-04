import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isProviderDetail,
  isResourceLookupResponse,
  realApi,
  resourceLookupPath,
} from "../src/api/realAdapter.ts";
import {
  buildResourceLookupRequest,
  changeAreaFilter,
  changeLookupCity,
  changeResourceCategory,
  initialLookupForm,
  previousLookupPage,
  withIncludeUnconfirmed,
  type LookupForm,
} from "../src/resources/resourceLookup.ts";

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

test("the existing assistive-device recommendation never includes the lookup-only unconfirmed provider", () => {
  const recommendation = json(`${fixtures}../recommendations/ASSISTIVE_DEVICE.json`).data;
  const ids = recommendation.providers.map((provider: { id: string }) => provider.id);
  assert.deepEqual(ids, ["PROV-MOCK-201", "PROV-MOCK-202", "PROV-MOCK-203"]);
  assert.equal(ids.includes("PROV-MOCK-204"), false);
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

test("lookup request trims text and sends every supported filter without UI-only fields", () => {
  const form: LookupForm = {
    resourceCategory: "SERVICE_PROVIDER",
    serviceType: "ASSISTIVE_DEVICE",
    city: "新北市",
    district: "三重區",
    areaFilter: "SERVICE_AREA",
    includeUnconfirmed: true,
    contractCity: "臺北市",
    q: "  輔具 商行  ",
  };
  assert.deepEqual(buildResourceLookupRequest(form, 3), {
    resourceCategory: "SERVICE_PROVIDER",
    serviceType: "ASSISTIVE_DEVICE",
    city: "新北市",
    district: "三重區",
    areaFilter: "SERVICE_AREA",
    includeUnconfirmed: true,
    contractCity: "臺北市",
    q: "輔具 商行",
    page: 3,
    pageSize: 20,
  });
});

test("other city produces no request, so the page can render the local 1966 state without an API call", () => {
  assert.equal(buildResourceLookupRequest({ ...initialLookupForm, city: "OTHER" }), null);
});

test("dependent filters clear when resource category, city or area mode makes them invalid", () => {
  const selected: LookupForm = {
    ...initialLookupForm,
    resourceCategory: "SERVICE_PROVIDER",
    serviceType: "ASSISTIVE_DEVICE",
    city: "新北市",
    district: "三重區",
    areaFilter: "SERVICE_AREA",
    includeUnconfirmed: true,
  };
  const center = changeResourceCategory(selected, "ASSISTIVE_DEVICE_CENTER");
  assert.equal(center.serviceType, "");

  const switchedCity = changeLookupCity(selected, "臺北市");
  assert.equal(switchedCity.district, "");
  assert.equal(switchedCity.areaFilter, "SERVICE_AREA");
  assert.equal(switchedCity.includeUnconfirmed, true);

  const unsupported = changeLookupCity(selected, "OTHER");
  assert.equal(unsupported.district, "");
  assert.equal(unsupported.areaFilter, "");
  assert.equal(unsupported.includeUnconfirmed, false);

  const locatedIn = changeAreaFilter(selected, "LOCATED_IN");
  assert.equal(locatedIn.includeUnconfirmed, false);
});

test("unconfirmed toggle preserves the submitted filters and resets the request to page one", () => {
  const submitted: LookupForm = {
    ...initialLookupForm,
    serviceType: "ASSISTIVE_DEVICE",
    city: "新北市",
    district: "三重區",
    q: "輔具",
  };
  const enabled = withIncludeUnconfirmed(submitted, true);
  assert.deepEqual(enabled, { ...submitted, areaFilter: "SERVICE_AREA", includeUnconfirmed: true });
  assert.equal(buildResourceLookupRequest(enabled)?.page, 1);
  const disabled = withIncludeUnconfirmed(enabled, false);
  assert.equal(disabled.includeUnconfirmed, false);
  assert.equal("includeUnconfirmed" in (buildResourceLookupRequest(disabled) ?? {}), false);
});

test("pagination never requests a page below one", () => {
  assert.equal(previousLookupPage(1), 1);
  assert.equal(previousLookupPage(2), 1);
  assert.equal(previousLookupPage(5), 4);
});

test("real lookup path serializes and encodes only contracted query parameters", () => {
  assert.equal(resourceLookupPath({}), "/providers");
  assert.equal(
    resourceLookupPath({
      resourceCategory: "SERVICE_PROVIDER",
      serviceType: "ASSISTIVE_DEVICE",
      city: "新北市",
      district: "三重區",
      areaFilter: "SERVICE_AREA",
      includeUnconfirmed: true,
      contractCity: "臺北市",
      q: "輔具 商行",
      page: 2,
      pageSize: 20,
    }),
    "/providers?resourceCategory=SERVICE_PROVIDER&serviceType=ASSISTIVE_DEVICE&city=%E6%96%B0%E5%8C%97%E5%B8%82&district=%E4%B8%89%E9%87%8D%E5%8D%80&areaFilter=SERVICE_AREA&includeUnconfirmed=true&contractCity=%E8%87%BA%E5%8C%97%E5%B8%82&q=%E8%BC%94%E5%85%B7+%E5%95%86%E8%A1%8C&page=2&pageSize=20",
  );
});

test("real resource lookup is public and performs one GET without a session credential", async () => {
  const valid = json(`${fixtures}lookup/list-all-first-page-response.json`).data;
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ success: true, data: valid }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const response = await realApi.getProviders({ city: "新北市", page: 1, pageSize: 20 });
    assert.equal(response.totalCount, valid.totalCount);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/v1/providers?city=%E6%96%B0%E5%8C%97%E5%B8%82&page=1&pageSize=20");
    assert.equal(calls[0].init.method, "GET");
    assert.equal((calls[0].init.headers as Record<string, string>)["X-Kareo-Session-Token"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lookup page keeps loading, retry, clear and page controls wired to state", () => {
  const page = read(`${src}pages/ResourceLookupPage.tsx`);
  assert.match(page, /setState\(\{ status: "loading" \}\)/);
  assert.match(page, /setAttempt\(\(value\) => value \+ 1\)/);
  assert.match(page, /setForm\(initialLookupForm\); setSubmittedForm\(initialLookupForm\); setPage\(1\)/);
  assert.match(page, /onClick=\{\(\) => setPage\(\(value\) => value \+ 1\)\}/);
});
