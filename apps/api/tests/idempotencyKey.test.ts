import { describe, it, expect } from "vitest";
import { requireIdempotencyKey } from "../src/lib/idempotencyKey.js";
import { AppError } from "../src/errors/AppError.js";

describe("requireIdempotencyKey (API_CONTRACT §3.3)", () => {
  it("accepts a valid UUID", () => {
    expect(requireIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("accepts uppercase UUIDs", () => {
    expect(requireIdempotencyKey("550E8400-E29B-41D4-A716-446655440000")).toBe(
      "550E8400-E29B-41D4-A716-446655440000"
    );
  });

  it("rejects a missing key", () => {
    expect(() => requireIdempotencyKey(undefined)).toThrow(AppError);
    try {
      requireIdempotencyKey(undefined);
    } catch (err) {
      expect((err as AppError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects a malformed key", () => {
    expect(() => requireIdempotencyKey("not-a-uuid")).toThrow(AppError);
    expect(() => requireIdempotencyKey(12345)).toThrow(AppError);
  });
});
