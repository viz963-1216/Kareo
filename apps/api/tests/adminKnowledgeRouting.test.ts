// J-003-r8（Jerry 委託審查 #48，文件／整合）：「netlify.toml 的管理路由由 J 接線，需驗證帶 id
// 的路徑正確傳到 handler，不能只讓靜態 route checker 通過」——同 providerDetailRouting.test.ts
// 既有模式，直接驗證 extractRecordId／extractChangeId 從 Netlify 的 event.path／event.rawUrl
// 正確解析出帶路徑參數的 id（Netlify Functions 沒有 pathParameters）。
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractRecordId, handler as decisionHandler } from "../src/functions/adminKnowledgeRecordDecision.js";
import { extractChangeId, handler as dismissHandler } from "../src/functions/adminKnowledgeChangeDismiss.js";

describe("adminKnowledgeRecordDecision: id from /api/v1/admin/knowledge/records/{id}/decision", () => {
  it("reads the id from the original path", () => {
    expect(extractRecordId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/records/KREC-001/decision" })).toBe(
      "KREC-001"
    );
  });

  it("accepts a trailing slash and URL-decodes the id", () => {
    expect(extractRecordId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/records/KREC-001/decision/" })).toBe(
      "KREC-001"
    );
    expect(extractRecordId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/records/KREC%2D001/decision" })).toBe(
      "KREC-001"
    );
  });

  it("falls back to rawUrl when the Netlify rewrite replaces path with the function path", () => {
    expect(
      extractRecordId({
        httpMethod: "POST",
        body: null,
        path: "/.netlify/functions/adminKnowledgeRecordDecision",
        rawUrl: "https://kareo.example/api/v1/admin/knowledge/records/KREC-002/decision",
      })
    ).toBe("KREC-002");
  });

  it("falls back to ?id= only when the path has no id", () => {
    expect(
      extractRecordId({
        httpMethod: "POST",
        body: null,
        path: "/.netlify/functions/adminKnowledgeRecordDecision",
        queryStringParameters: { id: "Q-1" },
      })
    ).toBe("Q-1");
  });

  it("does not match a different sub-path (e.g. .../dismiss) or a missing id", () => {
    expect(extractRecordId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/records//decision" })).toBeUndefined();
    expect(
      extractRecordId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/changes/KC-001/dismiss" })
    ).toBeUndefined();
  });

  it("a real Netlify-style event with an id in the path reaches the service layer (safe SESSION_INVALID without a token)", async () => {
    const res = await decisionHandler({
      httpMethod: "POST",
      path: "/api/v1/admin/knowledge/records/KREC-001/decision",
      body: JSON.stringify({ decision: "APPROVED", reason: "r", expectedContentFingerprint: "fp", confirm: true }),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("SESSION_INVALID");
  });
});

describe("adminKnowledgeChangeDismiss: id from /api/v1/admin/knowledge/changes/{id}/dismiss", () => {
  it("reads the id from the original path", () => {
    expect(extractChangeId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/changes/KC-001/dismiss" })).toBe(
      "KC-001"
    );
  });

  it("falls back to rawUrl when the Netlify rewrite replaces path with the function path", () => {
    expect(
      extractChangeId({
        httpMethod: "POST",
        body: null,
        path: "/.netlify/functions/adminKnowledgeChangeDismiss",
        rawUrl: "https://kareo.example/api/v1/admin/knowledge/changes/KC-002/dismiss",
      })
    ).toBe("KC-002");
  });

  it("does not match the decision sub-path or a missing id", () => {
    expect(
      extractChangeId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/records/KREC-001/decision" })
    ).toBeUndefined();
    expect(extractChangeId({ httpMethod: "POST", body: null, path: "/api/v1/admin/knowledge/changes//dismiss" })).toBeUndefined();
  });

  it("a real Netlify-style event with an id in the path reaches the service layer (safe SESSION_INVALID without a token)", async () => {
    const res = await dismissHandler({
      httpMethod: "POST",
      path: "/api/v1/admin/knowledge/changes/KC-001/dismiss",
      body: JSON.stringify({ reason: "r", confirm: true }),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe("SESSION_INVALID");
  });
});

// Isolate persistence here; actual handler quotas are covered by handlerSecurity.test.ts.
import { SupabaseRateLimitRepository } from "../src/repositories/supabaseRateLimitRepository.js";
beforeEach(() => { vi.spyOn(SupabaseRateLimitRepository.prototype, "checkAndIncrement").mockResolvedValue({ allowed: true, retryAfterSeconds: null }); });
afterEach(() => { vi.restoreAllMocks(); });
