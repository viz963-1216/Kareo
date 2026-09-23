import { describe, it, expect, beforeEach } from "vitest";
import { extractProviderId, handler } from "../src/functions/providerDetail.js";

describe("providerDetail: providerId from the request (Netlify has no pathParameters)", () => {
  it("reads the id from the original path /api/v1/providers/{id}", () => {
    expect(extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/TP-HC-001" })).toBe("TP-HC-001");
  });

  it("accepts a trailing slash", () => {
    expect(extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/TP-HC-001/" })).toBe("TP-HC-001");
  });

  it("URL-decodes the id", () => {
    expect(extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/PROV%2D001" })).toBe("PROV-001");
  });

  it("falls back to rawUrl when path is the function path (rewrite keeps the original URL there)", () => {
    expect(
      extractProviderId({
        httpMethod: "GET",
        path: "/.netlify/functions/providerDetail",
        rawUrl: "https://kareo.example/api/v1/providers/NTPC-HC-003?x=1",
      })
    ).toBe("NTPC-HC-003");
  });

  it("falls back to ?providerId= only when the path has no id", () => {
    expect(
      extractProviderId({ httpMethod: "GET", path: "/.netlify/functions/providerDetail", queryStringParameters: { providerId: "Q-1" } })
    ).toBe("Q-1");
    expect(
      extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/P-1", queryStringParameters: { providerId: "Q-1" } })
    ).toBe("P-1");
  });

  it("returns undefined for no id, a nested path, or malformed percent-encoding (never throws)", () => {
    expect(extractProviderId({ httpMethod: "GET", path: "/.netlify/functions/providerDetail" })).toBeUndefined();
    expect(extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/" })).toBeUndefined();
    expect(extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/A/services" })).toBeUndefined();
    expect(extractProviderId({ httpMethod: "GET", path: "/api/v1/providers/%E0%A4%A" })).toBeUndefined();
  });
});

describe("providerDetail handler with a real Netlify-style event", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("an id in the path passes validation and reaches the repository (safe INTERNAL_ERROR without Supabase)", async () => {
    const res = await handler({ httpMethod: "GET", path: "/api/v1/providers/TP-HC-001" });
    expect(JSON.parse(res.body).error.code).toBe("INTERNAL_ERROR");
  });

  it("no id anywhere -> VALIDATION_ERROR", async () => {
    const res = await handler({ httpMethod: "GET", path: "/api/v1/providers/" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });
});
