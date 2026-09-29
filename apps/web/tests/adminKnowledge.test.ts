import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { adminRealApi } from "../src/api/adminRealAdapter.ts";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key: string) { return this.#values.get(key) ?? null; }
  key(index: number) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string) { this.#values.delete(key); }
  setItem(key: string, value: string) { this.#values.set(key, value); }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function adminFixture(path: string) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../../contracts/mock/admin/${path}`, import.meta.url)), "utf8"));
}

async function withAdminResponse<T>(data: unknown, operation: () => Promise<T>): Promise<T> {
  const storage = new MemoryStorage();
  storage.setItem("kareo.adminToken", "admin-token");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ success: true, data });
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
    adminRealApi.logout();
  }
}

test("admin login stores only the dedicated admin token in sessionStorage", async () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>)["X-Kareo-Admin-Token"], undefined);
    assert.deepEqual(JSON.parse(String(init?.body)), { operatorId: "jerry", operatorKey: "secret" });
    return jsonResponse({ success: true, data: { adminToken: "admin-only", expiresAt: "2026-09-29T12:15:00+08:00" } });
  };
  try {
    await adminRealApi.login("jerry", "secret");
    assert.equal(storage.getItem("kareo.adminToken"), "admin-only");
    assert.equal(storage.getItem("kareo.sessionToken"), null);
  } finally {
    globalThis.fetch = originalFetch;
    adminRealApi.logout();
  }
});

test("admin reads use X-Kareo-Admin-Token and never the consumer token", async () => {
  const storage = new MemoryStorage();
  storage.setItem("kareo.adminToken", "admin-token");
  storage.setItem("kareo.sessionToken", "consumer-token");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers["X-Kareo-Admin-Token"], "admin-token");
    assert.equal(headers["X-Kareo-Session-Token"], undefined);
    return jsonResponse({ success: true, data: { publishedVersion: null, publishedAt: null, lastCrawlerRun: null } });
  };
  try {
    await adminRealApi.getStatus();
  } finally {
    globalThis.fetch = originalFetch;
    adminRealApi.logout();
  }
});

test("SESSION_INVALID clears only the admin token", async () => {
  const storage = new MemoryStorage();
  storage.setItem("kareo.adminToken", "expired");
  storage.setItem("kareo.sessionToken", "consumer-token");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    success: false,
    error: { code: "SESSION_INVALID", message: "管理工作階段已失效" },
  }, 401);
  try {
    await assert.rejects(() => adminRealApi.getStatus(), { name: "ApiError", code: "SESSION_INVALID" });
    assert.equal(storage.getItem("kareo.adminToken"), null);
    assert.equal(storage.getItem("kareo.sessionToken"), "consumer-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin route is hidden from navigation, applies noindex, and exposes contracted writes", () => {
  const root = fileURLToPath(new URL("../src/", import.meta.url));
  const app = readFileSync(`${root}App.tsx`, "utf8");
  const noIndex = readFileSync(`${root}components/NoIndex.tsx`, "utf8");
  const api = readFileSync(`${root}api/index.ts`, "utf8");
  assert.match(app, /path="\/admin\/knowledge"/);
  assert.doesNotMatch(app, /to="\/admin\/knowledge"/);
  assert.match(noIndex, /noindex, nofollow/);
  for (const write of ["decideRecord", "dismissChange", "getPublishPreview", "publish", "getRestorableVersions", "withdraw"]) {
    assert.match(api, new RegExp(write));
  }
});

test("admin review UI requires a reason, explicit confirmation, and the current fingerprint", () => {
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  assert.match(page, /maxLength=\{500\}/);
  assert.match(page, /reviewConfirmed/);
  assert.match(page, /expectedContentFingerprint: reviewAction\.record\.contentFingerprint/);
  assert.match(page, /confirm: true/);
  assert.match(page, /KNOWLEDGE_STATE_CHANGED/);
});

test("publishing and withdrawal require previews and explicit confirmation", () => {
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  assert.match(page, /preview\.canPublish/);
  assert.match(page, /preview\.previewToken/);
  assert.match(page, /publishConfirmed/);
  assert.match(page, /republishVersionId: selectedRepublishVersion/);
  assert.match(page, /使用者評估將暫停/);
});

test("withdrawal only accepts the latest restorable list and stays visible without a current version", () => {
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  assert.match(page, /restorable\?\.versions\.some\(\(version\) => version\.versionId === republishVersionId\)/);
  assert.match(page, /selectionIsCurrent/);
  assert.match(page, /可恢復版本清單已更新/);
  assert.match(page, /\{restorable && \(/);
  assert.match(page, /目前沒有可撤回的已發布版本/);
  assert.match(page, /disabled=\{!restorable\.currentVersion \|\| writeBusy\}/);
  assert.doesNotMatch(page, /input[^>]+republishVersionId/);
});

test("mock withdrawal uses official fixtures and transitions published state", () => {
  const adapter = readFileSync(fileURLToPath(new URL("../src/api/adminMockAdapter.ts", import.meta.url)), "utf8");
  assert.match(adapter, /knowledge-restorable-versions-empty-response\.json/);
  assert.match(adapter, /knowledge-restorable-versions-no-current-response\.json/);
  assert.match(adapter, /knowledge-status-after-publish-response\.json/);
  assert.match(adapter, /knowledge-status-no-published-response\.json/);
  assert.match(adapter, /body\.republishVersionId === null/);
  assert.match(adapter, /restorableVersions = body\.republishVersionId === null/);
  assert.match(adapter, /resetMockState\(\)/);
});

test("publish and review UI use API results and show all non-zero preview counts", () => {
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  const adapter = readFileSync(fileURLToPath(new URL("../src/api/adminMockAdapter.ts", import.meta.url)), "utf8");
  assert.match(page, /result\.versionId/);
  assert.match(page, /result\.totalRecordCount/);
  assert.match(page, /preview\.supersededRecordCount > 0/);
  assert.match(page, /preview\.excludedRecordCount > 0/);
  assert.match(page, />不影響內容</);
  assert.match(page, />退回</);
  assert.match(adapter, /knowledge-publish-preview-version-exists-response\.json/);
  assert.match(adapter, /publishPreview = structuredClone\(previewVersionExistsFixture\.data\)/);
});

test("admin mock scenarios cover every contracted empty and error screen", () => {
  const scenarios = readFileSync(fileURLToPath(new URL("../src/api/mockScenarios.ts", import.meta.url)), "utf8");
  const adapter = readFileSync(fileURLToPath(new URL("../src/api/adminMockAdapter.ts", import.meta.url)), "utf8");
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  for (const scenario of ["empty", "session-invalid", "forbidden", "validation-error", "state-changed", "publish-blocked", "restore-unavailable", "no-current"]) {
    assert.match(scenarios, new RegExp(`"${scenario}"`));
  }
  for (const fixture of [
    "knowledge-changes-empty-response", "knowledge-records-empty-response", "knowledge-publish-preview-no-approved-response",
    "knowledge-restorable-versions-empty-response", "knowledge-restorable-versions-no-current-response",
    "session-invalid-response", "forbidden-response", "validation-reason-required-response",
    "publish-preview-stale-response", "republish-version-unavailable-response",
  ]) assert.match(adapter, new RegExp(`${fixture}\\.json`));
  assert.match(page, /view === "forbidden"/);
  assert.match(page, /沒有管理權限/);
  assert.match(page, /目前沒有可撤回的已發布版本/);
});

test("admin writes share a synchronous lock and clear stale 409 state", () => {
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  assert.match(page, /const writeLockRef = useRef\(false\)/);
  assert.match(page, /if \(!reviewAction \|\| writeLockRef\.current\) return/);
  assert.match(page, /publishConfirmed \|\| writeLockRef\.current\) return/);
  assert.match(page, /withdrawConfirmed \|\| writeLockRef\.current\) return/);
  assert.ok((page.match(/writeLockRef\.current = true/g) ?? []).length >= 3);
  assert.ok((page.match(/writeLockRef\.current = false/g) ?? []).length >= 3);
  assert.match(page, /setPreview\(null\)/);
  assert.match(page, /setRepublishVersionId\(""\)/);
  assert.match(page, /setRestorable\(null\)/);
  assert.match(page, /disabled=\{writeBusy\}/);
});

test("admin publish rejects empty, incomplete, mismatched, and invalid-count success data", async () => {
  const request = { versionId: "KB-MOCK-002", previewToken: "PPV-MOCK-002-7f3a", confirm: true as const };
  const valid = adminFixture("knowledge-publish-response.json").data;
  assert.equal((await withAdminResponse(valid, () => adminRealApi.publish(request))).versionId, request.versionId);

  const invalidCases = [
    {},
    { ...valid, versionId: undefined },
    { ...valid, versionId: "KB-WRONG" },
    { ...valid, totalRecordCount: -1 },
    { ...valid, publishedRecordCount: 1.5 },
    { ...valid, carriedForwardCount: "15" },
    { ...valid, totalRecordCount: 99 },
  ];
  for (const data of invalidCases) {
    await assert.rejects(() => withAdminResponse(data, () => adminRealApi.publish(request)), { name: "ApiError", code: "INVALID_RESPONSE" });
  }
});

test("admin decision and dismiss validate response IDs, states, and review decisions", async () => {
  const decisionRequest = { decision: "APPROVED" as const, reason: "已核對", expectedContentFingerprint: "sha256:test", confirm: true as const };
  const decision = adminFixture("knowledge-record-approved-response.json").data;
  assert.equal((await withAdminResponse(decision, () => adminRealApi.decideRecord("KREC-MOCK-001", decisionRequest))).record.status, "APPROVED");
  for (const data of [
    {},
    { ...decision, record: { ...decision.record, id: "KREC-WRONG" } },
    { ...decision, record: { ...decision.record, status: "REJECTED" } },
    { ...decision, review: { ...decision.review, decision: "REJECTED" } },
  ]) await assert.rejects(() => withAdminResponse(data, () => adminRealApi.decideRecord("KREC-MOCK-001", decisionRequest)), { code: "INVALID_RESPONSE" });

  const dismissRequest = { reason: "不影響內容", confirm: true as const };
  const dismiss = adminFixture("knowledge-change-dismissed-response.json").data;
  assert.equal((await withAdminResponse(dismiss, () => adminRealApi.dismissChange("KC-MOCK-001", dismissRequest))).change.status, "DISMISSED");
  for (const data of [
    { ...dismiss, change: { ...dismiss.change, id: "KC-WRONG" } },
    { ...dismiss, change: { ...dismiss.change, status: "NEEDS_REVIEW" } },
    { ...dismiss, review: { ...dismiss.review, decision: "APPROVED" } },
  ]) await assert.rejects(() => withAdminResponse(data, () => adminRealApi.dismissChange("KC-MOCK-001", dismissRequest)), { code: "INVALID_RESPONSE" });
});

test("admin withdrawal requires response versions to exactly match the request", async () => {
  const request = { withdrawVersionId: "KB-MOCK-002", republishVersionId: "KB-MOCK-001", reason: "版本有誤", confirm: true as const };
  const valid = adminFixture("knowledge-withdraw-response.json").data;
  assert.equal((await withAdminResponse(valid, () => adminRealApi.withdraw(request))).republishedVersionId, request.republishVersionId);
  for (const data of [
    {},
    { ...valid, withdrawnVersionId: "KB-WRONG" },
    { ...valid, republishedVersionId: null },
    { ...valid, withdrawnAt: undefined },
  ]) await assert.rejects(() => withAdminResponse(data, () => adminRealApi.withdraw(request)), { code: "INVALID_RESPONSE" });

  const noRepublishRequest = { withdrawVersionId: "KB-MOCK-001", republishVersionId: null, reason: "暫停使用", confirm: true as const };
  const noRepublish = adminFixture("knowledge-withdraw-no-republish-response.json").data;
  assert.equal((await withAdminResponse(noRepublish, () => adminRealApi.withdraw(noRepublishRequest))).republishedVersionId, null);
});

test("admin read endpoints reject malformed success data and accept complete fixtures", async () => {
  const status = adminFixture("knowledge-status-response.json").data;
  assert.equal((await withAdminResponse(status, () => adminRealApi.getStatus())).publishedVersion, "KB-MOCK-001");
  await assert.rejects(() => withAdminResponse({ ...status, lastCrawlerRun: { status: "UNKNOWN" } }, () => adminRealApi.getStatus()), { code: "INVALID_RESPONSE" });

  const changes = adminFixture("knowledge-changes-response.json").data;
  assert.equal((await withAdminResponse(changes, () => adminRealApi.getChanges())).length, 1);
  await assert.rejects(() => withAdminResponse({ changes: [{}] }, () => adminRealApi.getChanges()), { code: "INVALID_RESPONSE" });

  const records = adminFixture("knowledge-records-response.json").data;
  assert.equal((await withAdminResponse(records, () => adminRealApi.getRecords())).length, 1);
  await assert.rejects(() => withAdminResponse({ records: [{ ...records.records[0], contentFingerprint: null }] }, () => adminRealApi.getRecords()), { code: "INVALID_RESPONSE" });

  const preview = adminFixture("knowledge-publish-preview-response.json").data;
  assert.equal((await withAdminResponse(preview, () => adminRealApi.getPublishPreview())).canPublish, true);
  for (const data of [{}, { ...preview, previewToken: null }, { ...preview, blockers: [{}] }, { ...preview, totalRecordCount: "16" }]) {
    await assert.rejects(() => withAdminResponse(data, () => adminRealApi.getPublishPreview()), { code: "INVALID_RESPONSE" });
  }

  const restorable = adminFixture("knowledge-restorable-versions-response.json").data;
  assert.equal((await withAdminResponse(restorable, () => adminRealApi.getRestorableVersions())).versions.length, 1);
  for (const data of [{}, { ...restorable, versions: [{}] }, { ...restorable, currentVersion: { ...restorable.currentVersion, recordCount: -1 } }]) {
    await assert.rejects(() => withAdminResponse(data, () => adminRealApi.getRestorableVersions()), { code: "INVALID_RESPONSE" });
  }
});

test("admin page only shows success after validated adapter calls resolve", () => {
  const page = readFileSync(fileURLToPath(new URL("../src/pages/AdminKnowledgePage.tsx", import.meta.url)), "utf8");
  assert.match(page, /const result = await adminApi\.publish[\s\S]*setNotice\(`版本 \$\{result\.versionId\}/);
  assert.match(page, /const result = await adminApi\.withdraw[\s\S]*setNotice\(result\.republishedVersionId/);
  assert.match(page, /const result = await adminApi\.decideRecord[\s\S]*setNotice\(result\.record\.status/);
  assert.match(page, /const result = await adminApi\.dismissChange[\s\S]*setNotice\(`來源 \$\{result\.change\.sourceId\}/);
});
