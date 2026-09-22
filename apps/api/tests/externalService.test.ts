import { describe, it, expect } from "vitest";
import { getTransportationExternalService } from "../src/services/externalServiceService.js";
import { handler as transportationHandler } from "../src/functions/externalServiceTransportation.js";

describe("External Service - Kareocar (TASK-B-007)", () => {
  it("returns a response shape that fully matches API_CONTRACT.md section 11", () => {
    const data = getTransportationExternalService();

    expect(data).toEqual({
      id: "EXT-001",
      name: "Kareocar",
      serviceType: "TRANSPORTATION",
      url: "https://kareocar.netlify.app/",
      openMode: "NEW_TAB",
      notice: "此服務將前往外部 Kareocar 平台。",
    });
  });

  it("returns the correct official Kareocar URL", () => {
    const data = getTransportationExternalService();
    expect(data.url).toBe("https://kareocar.netlify.app/");
  });

  it("always opens in a new tab, never embedded (openMode = NEW_TAB, no iframe field)", () => {
    const data = getTransportationExternalService();
    expect(data.openMode).toBe("NEW_TAB");
    expect(Object.keys(data)).not.toContain("iframe");
    expect(Object.keys(data)).not.toContain("embed");
  });

  it("response never contains database/auth-sharing fields (no backend/DB/auth integration)", () => {
    const data = getTransportationExternalService();
    const forbiddenKeys = ["token", "accessToken", "authToken", "sessionId", "apiKey", "secret"];
    for (const key of forbiddenKeys) {
      expect(Object.keys(data)).not.toContain(key);
    }
  });

  it("handler returns success response via GET", async () => {
    const res = await transportationHandler({ httpMethod: "GET" });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: "EXT-001",
      name: "Kareocar",
      serviceType: "TRANSPORTATION",
      url: "https://kareocar.netlify.app/",
      openMode: "NEW_TAB",
      notice: "此服務將前往外部 Kareocar 平台。",
    });
  });

  it("handler rejects non-GET method", async () => {
    const res = await transportationHandler({ httpMethod: "POST" });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });
});
