// TASK-B-012-r3：publish-preview／publish 沒有路徑參數（跟 withdraw／restorable-versions 一樣是
// 單純 GET／POST），這裡驗證 handler 本身的方法檢查與「沒有 session 時安全回 401」，服務層邏輯
// （compute_publish_plan／adminPublish 的各種 blocker／狀態改變）已經在 adminKnowledgeService.test.ts
// 覆蓋，不在這裡重複。
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handler as previewHandler } from "../src/functions/adminKnowledgePublishPreview.js";
import { handler as publishHandler } from "../src/functions/adminKnowledgePublish.js";

describe("adminKnowledgePublishPreview: GET /api/v1/admin/knowledge/publish-preview", () => {
  it("rejects a non-GET method with INVALID_REQUEST", async () => {
    const res = await previewHandler({ httpMethod: "POST" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_REQUEST");
  });

  it("a real request without a session token safely returns SESSION_INVALID (no data leaked)", async () => {
    const res = await previewHandler({ httpMethod: "GET" });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("SESSION_INVALID");
  });
});

describe("adminKnowledgePublish: POST /api/v1/admin/knowledge/publish", () => {
  it("rejects a non-POST method with INVALID_REQUEST", async () => {
    const res = await publishHandler({ httpMethod: "GET", body: null });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_REQUEST");
  });

  it("rejects a malformed JSON body with INVALID_REQUEST", async () => {
    const res = await publishHandler({ httpMethod: "POST", body: "{not json" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_REQUEST");
  });

  it("a real request without a session token safely returns SESSION_INVALID (no publish happens)", async () => {
    const res = await publishHandler({
      httpMethod: "POST",
      body: JSON.stringify({ versionId: "KB-2026-10-01-001", previewToken: "PPV-x", confirm: true }),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("SESSION_INVALID");
  });
});

// Isolate persistence here; actual handler quotas are covered by handlerSecurity.test.ts.
import { SupabaseRateLimitRepository } from "../src/repositories/supabaseRateLimitRepository.js";
beforeEach(() => { vi.spyOn(SupabaseRateLimitRepository.prototype, "checkAndIncrement").mockResolvedValue({ allowed: true, retryAfterSeconds: null }); });
afterEach(() => { vi.restoreAllMocks(); });
