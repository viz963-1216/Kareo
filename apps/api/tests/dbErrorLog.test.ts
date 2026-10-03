import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insert = vi.fn();
vi.mock("../src/repositories/supabaseClient.js", () => ({
  getSupabaseClient: () => ({ from: () => ({ insert }) }),
}));

import { SupabaseSessionRepository } from "../src/repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../src/repositories/supabaseConsentRepository.js";
import { describeDbError, sanitizeDbErrorMessage } from "../src/lib/dbErrorLog.js";
import { errorResponse } from "../src/lib/response.js";
import { AppError } from "../src/errors/AppError.js";

// What PostgREST returns when the cloud sessions table predates 0008_session_token.sql.
const MISSING_COLUMN = {
  code: "PGRST204",
  message: "Could not find the 'token_hash' column of 'sessions' in the schema cache",
  details: null,
  hint: null,
};

describe("Supabase error diagnostics (server log only)", () => {
  let logged: string[];

  beforeEach(() => {
    insert.mockReset();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs the PostgREST code and message when the session insert fails, but returns the generic error", async () => {
    insert.mockResolvedValue({ error: MISSING_COLUMN });

    const err = await new SupabaseSessionRepository().createSession().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    const response = errorResponse(err as AppError);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toEqual({ code: "INTERNAL_ERROR", message: "無法建立 Session，請稍後再試。" });
    expect(response.body).not.toContain("token_hash");

    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0])).toEqual({
      event: "db_error",
      operation: "sessions.insert",
      code: "PGRST204",
      message: MISSING_COLUMN.message,
    });
  });

  it("never logs the inserted token hash, details or hint", async () => {
    insert.mockResolvedValue({
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "sessions_token_hash_idx"',
        details: "Key (token_hash)=(SECRET-HASH-VALUE) already exists.",
        hint: "SECRET-HINT",
      },
    });

    await new SupabaseSessionRepository().createSession().catch(() => undefined);

    const row = insert.mock.calls[0][0] as { token_hash: string };
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain(row.token_hash);
    expect(logged[0]).not.toContain("SECRET-HASH-VALUE");
    expect(logged[0]).not.toContain("SECRET-HINT");
    expect(JSON.parse(logged[0]).code).toBe("23505");
  });

  it("logs consent insert failures under their own operation name", async () => {
    insert.mockResolvedValue({ error: { code: "PGRST204", message: "Could not find the 'withdrawn_at' column of 'consents' in the schema cache" } });

    await new SupabaseConsentRepository()
      .createConsent({ sessionId: "SES-1", disclaimerVersion: "v", privacyVersion: "v", termsVersion: "v", accepted: true })
      .catch(() => undefined);

    expect(JSON.parse(logged[0])).toMatchObject({ operation: "consents.insert", code: "PGRST204" });
  });

  it("redacts quoted values, key/value fragments and long opaque strings from messages", () => {
    expect(sanitizeDbErrorMessage('invalid input syntax for type uuid: "abc-123"')).toBe('invalid input syntax for type uuid: "<redacted>"');
    expect(sanitizeDbErrorMessage("Key (token_hash)=(xyz) already exists.")).toBe("Key (<redacted>)=(<redacted>) already exists.");
    expect(sanitizeDbErrorMessage(`bad ${"a".repeat(43)}`)).toBe("bad <redacted>");
    expect(sanitizeDbErrorMessage("ab ".repeat(200))).toHaveLength(200);
    expect(describeDbError("op", undefined)).toEqual({ event: "db_error", operation: "op", code: "UNKNOWN", message: "" });
  });
});
