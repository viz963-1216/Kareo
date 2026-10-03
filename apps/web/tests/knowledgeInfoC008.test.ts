import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  configureRealApi,
  isKnowledgeRecordsResponse,
  knowledgeRecordsPath,
  realApi,
} from "../src/api/realAdapter.ts";
import { KNOWLEDGE_MOCK_SCENARIOS } from "../src/api/mockScenarios.ts";
import {
  initialKnowledgeFilters,
  knowledgeRequest,
  knowledgeSummaryParagraphs,
  previousKnowledgePage,
} from "../src/knowledge/knowledgeInfo.ts";

const fixtures = fileURLToPath(new URL("../../../contracts/mock/knowledge/", import.meta.url));
const src = fileURLToPath(new URL("../src/", import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

test("all five public knowledge success fixtures satisfy the strict response validator", () => {
  const files = readdirSync(fixtures).filter((name) => name.endsWith("-response.json"));
  assert.equal(files.length, 5);
  for (const file of files) assert.equal(isKnowledgeRecordsResponse(json(`${fixtures}${file}`).data), true, file);
});

test("knowledge response validation rejects internal fields and malformed source data", () => {
  const valid = json(`${fixtures}records-new-taipei-assistive-device-response.json`).data;
  assert.equal(isKnowledgeRecordsResponse({ ...valid, ruleData: {} }), false);
  assert.equal(isKnowledgeRecordsResponse({ ...valid, items: [{ ...valid.items[0], contentFingerprint: "private" }] }), false);
  assert.equal(isKnowledgeRecordsResponse({ ...valid, items: [{ ...valid.items[0], source: { ...valid.items[0].source, url: 123 } }] }), false);
  assert.equal(isKnowledgeRecordsResponse({ ...valid, totalCount: -1 }), false);
});

test("knowledge request supports only contracted filters and clamps previous page", () => {
  assert.deepEqual(knowledgeRequest({ jurisdiction: "NEW_TAIPEI", category: "ASSISTIVE_DEVICE" }, 2), {
    jurisdiction: "NEW_TAIPEI", category: "ASSISTIVE_DEVICE", page: 2, pageSize: 20,
  });
  assert.deepEqual(knowledgeRequest(initialKnowledgeFilters, 0), { page: 1, pageSize: 20 });
  assert.equal(previousKnowledgePage(1), 1);
  assert.equal(previousKnowledgePage(3), 2);
  assert.equal(knowledgeRecordsPath({ jurisdiction: "TAIPEI", category: "RESPITE", page: 2, pageSize: 20 }), "/knowledge/records?jurisdiction=TAIPEI&category=RESPITE&page=2&pageSize=20");
});

test("summary paragraphs preserve API text and remove only blank lines", () => {
  assert.deepEqual(knowledgeSummaryParagraphs("第一段\n\n 第二段 "), ["第一段", "第二段"]);
});

test("mock scenarios cover every five success and four error fixture screens", () => {
  assert.deepEqual(KNOWLEDGE_MOCK_SCENARIOS, [
    "first-page", "second-page", "taipei", "new-taipei-assistive-device", "empty",
    "invalid-jurisdiction", "invalid-category", "unknown-parameter", "knowledge-unavailable",
  ]);
});

test("a source without a URL is rendered as text rather than a link", () => {
  const page = readFileSync(`${src}pages/KnowledgeInfoPage.tsx`, "utf8");
  assert.match(page, /record\.source\.url\s*\?/);
  assert.match(page, /:\s*record\.source\.title/);
});

test("real knowledge lookup is public and sends one encoded GET without a session token", async () => {
  configureRealApi({ requireSessionToken: true, timeoutMs: 500 });
  const fixture = json(`${fixtures}records-empty-response.json`);
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(fixture), { status: 200 });
  }) as typeof fetch;
  try {
    await realApi.getKnowledgeRecords({ page: 1, pageSize: 20 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/v1/knowledge/records?page=1&pageSize=20");
    assert.equal(calls[0].init.method, "GET");
    assert.equal(Object.keys(calls[0].init.headers as object).some((key) => key.toLowerCase().includes("session")), false);
  } finally {
    globalThis.fetch = originalFetch;
    configureRealApi({ requireSessionToken: false });
  }
});

test("public information UI contains no personal eligibility claims", () => {
  const page = readFileSync(`${src}pages/KnowledgeInfoPage.tsx`, "utf8");
  for (const phrase of ["您符合", "已核定", "您可獲得"]) assert.equal(page.includes(phrase), false);
});
