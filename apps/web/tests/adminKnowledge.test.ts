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
  assert.match(page, /disabled=\{!restorable\.currentVersion\}/);
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
