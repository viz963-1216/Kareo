// Server-side diagnostics for Supabase/PostgREST errors (Function log only; the HTTP response keeps the generic
// INTERNAL_ERROR copy). Logs the error code and a cleaned message so a schema/permission mismatch can be told
// apart from a credential or network problem without guessing.
//
// Never logged: `details` / `hint` (Postgres puts row values there, e.g. a duplicate token_hash), request
// payloads, keys, session tokens or token hashes. Quoted values and `Key (...)=(...)` fragments in the message
// are redacted as a second guard.

interface DbErrorLike {
  code?: unknown;
  message?: unknown;
}

const MAX_MESSAGE_LENGTH = 200;

export function sanitizeDbErrorMessage(message: unknown): string {
  if (typeof message !== "string") return "";
  return message
    .replace(/\([^)]*\)=\([^)]*\)/g, "(<redacted>)=(<redacted>)")
    .replace(/:\s*"[^"]*"/g, ': "<redacted>"')
    .replace(/[A-Za-z0-9_-]{32,}/g, "<redacted>")
    .slice(0, MAX_MESSAGE_LENGTH);
}

export function describeDbError(operation: string, error: DbErrorLike | null | undefined) {
  return {
    event: "db_error",
    operation,
    code: typeof error?.code === "string" && error.code ? error.code : "UNKNOWN",
    message: sanitizeDbErrorMessage(error?.message),
  };
}

export function logDbError(operation: string, error: DbErrorLike | null | undefined): void {
  console.error(JSON.stringify(describeDbError(operation, error)));
}
