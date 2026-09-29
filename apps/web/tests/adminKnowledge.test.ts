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

test("admin route is hidden from navigation, applies noindex, and exposes no writes yet", () => {
  const root = fileURLToPath(new URL("../src/", import.meta.url));
  const app = readFileSync(`${root}App.tsx`, "utf8");
  const noIndex = readFileSync(`${root}components/NoIndex.tsx`, "utf8");
  const api = readFileSync(`${root}api/index.ts`, "utf8");
  assert.match(app, /path="\/admin\/knowledge"/);
  assert.doesNotMatch(app, /to="\/admin\/knowledge"/);
  assert.match(noIndex, /noindex, nofollow/);
  for (const write of ["decision", "dismiss", "publish", "withdraw"]) {
    assert.doesNotMatch(api, new RegExp(`admin.*${write}`, "i"));
  }
});
