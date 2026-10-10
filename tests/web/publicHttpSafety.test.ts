// J-003: local HTTP transport tests, NOT deployed browser/E2E evidence.
// Success bodies are contract fixtures; failures are injected only into a loopback server.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { test } from "node:test";
import { ApiError, configureRealApi, realApi } from "../../apps/web/src/api/realAdapter.ts";

const nativeFetch = globalThis.fetch;
const fixture = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const endpoints = [
  { name: "providers", run: () => realApi.getProviders({ city: "新北市", page: 2 }),
    reply: fixture("../../contracts/mock/providers/lookup/list-all-first-page-response.json") },
  { name: "knowledge", run: () => realApi.getKnowledgeRecords({ jurisdiction: "NEW_TAIPEI", category: "RESPITE" }),
    reply: fixture("../../contracts/mock/knowledge/records-empty-response.json") },
];
type Handler = (request: IncomingMessage, response: ServerResponse) => void;
type Observed = { method: string; path: string; token: string | undefined };

async function withServer(action: (setHandler: (handler: Handler) => void, calls: Observed[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const calls: Observed[] = [];
  let handler: Handler = (_request, response) => { response.writeHead(500); response.end(); };
  const server = createServer((request, response) => {
    calls.push({ method: request.method ?? "", path: request.url ?? "",
      token: request.headers["x-kareo-session-token"] as string | undefined });
    handler(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  // This wrapper ONLY resolves relative URLs; native fetch performs the socket exchange.
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    assert.ok(typeof input === "string" && input.startsWith("/api/v1/"));
    return nativeFetch(new URL(input, origin), init);
  }) as typeof fetch;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => "LOCAL-TEST-STALE-TOKEN", setItem: () => assert.fail("public lookup must not store credentials"),
    removeItem: () => assert.fail("public lookup must not change credentials"),
  } });
  configureRealApi({ requireSessionToken: true, timeoutMs: 5000 });
  try {
    await action((next) => { handler = next; }, calls);
    assert.ok(calls.length > 0);
    for (const call of calls) {
      assert.equal(call.method, "GET", "public lookup must not create a session or write data");
      assert.match(call.path, /^\/api\/v1\/(providers\?|knowledge\/records\?)/);
      assert.equal(call.token, undefined, "even a stored credential must not be transmitted");
    }
  } finally {
    globalThis.fetch = originalFetch;
    configureRealApi({ requireSessionToken: false });
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  }
}

const send = (status: number, body: unknown): Handler => (_request, response) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};
async function rejectsSafely(action: Promise<unknown>, code: string, status: number) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.doesNotMatch(error.message, /LOCAL-TEST-STALE-TOKEN|postgres|SUPABASE_SERVICE_ROLE_KEY|SQL|STACK/);
    return true;
  });
}

for (const endpoint of endpoints) {
  test(`${endpoint.name}: native HTTP GET omits a stored token and returns the validated response`, async () => {
    await withServer(async (setHandler, calls) => {
      setHandler(send(200, endpoint.reply));
      assert.deepEqual(await endpoint.run(), endpoint.reply.data);
      assert.equal(calls.length, 1);
    });
  });

  for (const code of ["INTERNAL_ERROR", "UNEXPECTED_UPSTREAM_ERROR"]) {
    test(`${endpoint.name}: ${code} never exposes server diagnostics; retry preserves filters`, async () => {
      await withServer(async (setHandler, calls) => {
        setHandler(send(503, { success: false, error: { code,
          message: "SQL postgres STACK SUPABASE_SERVICE_ROLE_KEY LOCAL-TEST-STALE-TOKEN" } }));
        await rejectsSafely(endpoint.run(), code, 503);
        assert.equal(calls.length, 1, "failure must not cause a hidden retry");
        setHandler(send(200, endpoint.reply));
        assert.deepEqual(await endpoint.run(), endpoint.reply.data);
        assert.equal(calls.length, 2);
        assert.equal(calls[0].path, calls[1].path);
      });
    });
  }

  test(`${endpoint.name}: HTTP 200 with malformed data fails without fake success`, async () => {
    await withServer(async (setHandler) => {
      setHandler(send(200, { success: true, data: {} }));
      await rejectsSafely(endpoint.run(), "INVALID_RESPONSE", 200);
    });
  });

  test(`${endpoint.name}: a platform HTML error is safe and can be retried`, async () => {
    await withServer(async (setHandler, calls) => {
      setHandler((_request, response) => {
        response.writeHead(502, { "Content-Type": "text/html" });
        response.end("<html>SQL postgres STACK LOCAL-TEST-STALE-TOKEN</html>");
      });
      await rejectsSafely(endpoint.run(), "HTTP_ERROR", 502);
      setHandler(send(200, endpoint.reply));
      assert.deepEqual(await endpoint.run(), endpoint.reply.data);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].path, calls[1].path);
    });
  });

  test(`${endpoint.name}: connection reset fails as NETWORK and retry succeeds`, async () => {
    await withServer(async (setHandler, calls) => {
      setHandler((request) => request.socket.destroy());
      await rejectsSafely(endpoint.run(), "NETWORK", 0);
      setHandler(send(200, endpoint.reply));
      assert.deepEqual(await endpoint.run(), endpoint.reply.data);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].path, calls[1].path);
    });
  });

  test(`${endpoint.name}: timeout while receiving the body is bounded and retry succeeds`, async () => {
    await withServer(async (setHandler, calls) => {
      configureRealApi({ requireSessionToken: true, timeoutMs: 100 });
      setHandler((_request, response) => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.write('{"success":true,"data":'); // deliberately never completes
      });
      await rejectsSafely(endpoint.run(), "TIMEOUT", 0);
      configureRealApi({ requireSessionToken: true, timeoutMs: 5000 });
      setHandler(send(200, endpoint.reply));
      assert.deepEqual(await endpoint.run(), endpoint.reply.data);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].path, calls[1].path);
    });
  });
}
