// Jerry 2026-10-03：B-014 收尾須「不記明文 IP／查詢條件」。這個端點的查詢參數是 jurisdiction／category／
// page／pageSize，這裡用哨兵字串固定：任何請求路徑都不得把提交的值寫進 log，錯誤回應也不得回聲提交的值。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../src/functions/knowledgeRecords.js";

const SENTINEL = "SENSITIVE-QUERY-0912345678";

function consoleOutput(spies: Array<ReturnType<typeof vi.spyOn>>): string {
  return spies.flatMap((s) => s.mock.calls.map((args: unknown[]) => args.map((a) => String(a)).join(" "))).join("\n");
}

describe("GET /api/v1/knowledge/records: query conditions never reach logs or error bodies", () => {
  let spies: Array<ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
  });

  it("a valid query reaches the repository (safe INTERNAL_ERROR without Supabase): nothing is logged or echoed", async () => {
    const response = await handler({ httpMethod: "GET", queryStringParameters: { jurisdiction: "TAIWAN", category: "BENEFIT", page: "1" } });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("TAIWAN");
    expect(consoleOutput(spies)).not.toContain("TAIWAN");
  });

  it("invalid values and undefined parameters are a 400 that does not echo what was submitted, and nothing is logged", async () => {
    for (const query of [
      { jurisdiction: SENTINEL },
      { category: SENTINEL },
      { page: SENTINEL },
      { pageSize: SENTINEL },
      { [SENTINEL]: "x" },
    ]) {
      const response = await handler({ httpMethod: "GET", queryStringParameters: query });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error.code).toBe("VALIDATION_ERROR");
      expect(response.body).not.toContain(SENTINEL);
    }
    expect(consoleOutput(spies)).not.toContain(SENTINEL);
  });

  it("a non-GET request is rejected without touching the query", async () => {
    const response = await handler({ httpMethod: "POST", queryStringParameters: { jurisdiction: SENTINEL } });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(SENTINEL);
    expect(consoleOutput(spies)).not.toContain(SENTINEL);
  });
});
