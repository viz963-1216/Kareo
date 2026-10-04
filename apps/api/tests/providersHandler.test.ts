// PRIVACY_AND_RETENTION §2：公開資源查詢的查詢條件（含自由文字 q）不得寫入 log，也不得在錯誤回應中被回聲。
// Jerry 2026-10-03：B-013 收尾須有「無敏感 log」的測試，而不是只靠程式註解。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../src/functions/providers.js";

const SENTINEL = "SENSITIVE-QUERY-0912345678";

function consoleOutput(spies: Array<ReturnType<typeof vi.spyOn>>): string {
  return spies.flatMap((s) => s.mock.calls.map((args: unknown[]) => args.map((a) => String(a)).join(" "))).join("\n");
}

describe("GET /api/v1/providers: query conditions never reach logs or error bodies", () => {
  let spies: Array<ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
  });

  it("a valid query reaches the repository (safe INTERNAL_ERROR without Supabase): q is neither logged nor echoed", async () => {
    const response = await handler({ httpMethod: "GET", queryStringParameters: { q: SENTINEL, serviceType: "HOME_CARE", city: "新北市" } });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(SENTINEL);
    expect(consoleOutput(spies)).not.toContain(SENTINEL);
  });

  it("an invalid query is a 400 that does not echo the submitted value, and nothing is logged", async () => {
    const response = await handler({ httpMethod: "GET", queryStringParameters: { q: SENTINEL, serviceType: SENTINEL, page: SENTINEL } });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe("VALIDATION_ERROR");
    expect(response.body).not.toContain(SENTINEL);
    expect(consoleOutput(spies)).not.toContain(SENTINEL);
  });

  it("a non-GET request is rejected without touching the query", async () => {
    const response = await handler({ httpMethod: "POST", queryStringParameters: { q: SENTINEL } });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(SENTINEL);
    expect(consoleOutput(spies)).not.toContain(SENTINEL);
  });
});
