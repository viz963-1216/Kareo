// TASK-B-011b：ARCHITECTURE §20.4 Payload 限制。
import { describe, it, expect } from "vitest";
import { requireBodySize, requireFreeTextLength } from "../src/services/requestLimitsService.js";

describe("requireBodySize", () => {
  it("allows a body under 16 KB", () => {
    expect(() => requireBodySize(JSON.stringify({ a: "x".repeat(100) }))).not.toThrow();
  });

  it("allows null/empty body", () => {
    expect(() => requireBodySize(null)).not.toThrow();
    expect(() => requireBodySize("")).not.toThrow();
  });

  it("rejects a body over 16 KB with PAYLOAD_TOO_LARGE", () => {
    const big = "x".repeat(16 * 1024 + 1);
    expect(() => requireBodySize(big)).toThrowError(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));
  });

  it("measures UTF-8 byte length, not character count (multi-byte characters count more)", () => {
    // 每個中文字在 UTF-8 通常是 3 bytes；6000 字約 18KB，超過 16KB 上限。
    const big = "長".repeat(6000);
    expect(() => requireBodySize(big)).toThrowError(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));
  });
});

describe("requireFreeTextLength", () => {
  it("allows up to 500 characters", () => {
    expect(() => requireFreeTextLength("x".repeat(500))).not.toThrow();
    expect(() => requireFreeTextLength("")).not.toThrow();
  });

  it("rejects over 500 characters with VALIDATION_ERROR", () => {
    expect(() => requireFreeTextLength("x".repeat(501))).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});
