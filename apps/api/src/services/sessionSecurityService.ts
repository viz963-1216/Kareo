// TASK-B-011a：Session／權限基礎共用元件。B-005、B-006、B-010 直接使用這裡的函式，
// 不各自實作 Token 驗證或資源歸屬檢查。依 docs/ARCHITECTURE.md §20、docs/API_CONTRACT.md §3.1。
import { randomBytes, createHash } from "node:crypto";
import type { SessionRepository } from "../repositories/types.js";
import type { Session } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { nowTaipeiISOString } from "../lib/response.js";

const IDLE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

// 依 ARCHITECTURE §20.1：至少 256 bits 的密碼學隨機值，禁止 Math.random()。
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// 資料庫只存雜湊，明文只在建立當下回傳一次（見 sessionService.createSession）。
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 依 ARCHITECTURE §20.2：閒置 7 天或建立後 30 天，取較早者。
export function computeExpiresAt(createdAt: Date, now: Date): Date {
  const idleExpiry = now.getTime() + IDLE_WINDOW_MS;
  const maxExpiry = createdAt.getTime() + MAX_LIFETIME_MS;
  return new Date(Math.min(idleExpiry, maxExpiry));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 依 ARCHITECTURE §20.3 第 1 步：token 存在、雜湊相符、未過期、status=ACTIVE，否則 SESSION_INVALID(401)。
// 呼叫端只需要傳入 Header 原始值（可能是 undefined／格式錯誤），不需要自己先做型別檢查。
export async function requireValidSession(repo: SessionRepository, tokenHeaderValue: unknown): Promise<Session> {
  if (!isNonEmptyString(tokenHeaderValue)) {
    throw new AppError("SESSION_INVALID", "缺少或格式錯誤的 X-Kareo-Session-Token。");
  }

  const tokenHash = hashSessionToken(tokenHeaderValue);
  const session = await repo.findByTokenHash(tokenHash);
  if (!session) {
    throw new AppError("SESSION_INVALID", "Session Token 無效。");
  }
  if (session.status !== "ACTIVE") {
    throw new AppError("SESSION_INVALID", "Session 已失效。");
  }

  const now = new Date();
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    throw new AppError("SESSION_INVALID", "Session 已過期。");
  }

  // 依 §20.2：每次成功請求更新 lastSeenAt（可節流，此處採最簡單的每次更新，正確性優先）。
  const newExpiresAt = computeExpiresAt(new Date(session.createdAt), now).toISOString();
  const nowIso = nowTaipeiISOString();
  await repo.touchSession(session.id, { lastSeenAt: nowIso, expiresAt: newExpiresAt });

  return { ...session, lastSeenAt: nowIso, expiresAt: newExpiresAt };
}

// 依 API_CONTRACT §3.1：Body 中的 sessionId 必須與 token 所屬 session 相同，否則 FORBIDDEN(403)。
// 只有 Body 真的帶了 sessionId 才檢查；沒有帶的 API（例如未來的 DELETE /session）不適用。
export function requireMatchingSessionId(session: Session, bodySessionId: unknown): void {
  if (bodySessionId !== undefined && bodySessionId !== session.id) {
    throw new AppError("FORBIDDEN", "sessionId 與目前的 Session Token 不一致。");
  }
}

// 依 ARCHITECTURE §20.3 第 4 步：引用的資源不屬於同一 session 時回 NOT_FOUND，不透露資源是否存在
// （不能回 FORBIDDEN，那會洩漏「這筆資料存在，只是不是你的」）。
export function requireOwnedResource(resourceSessionId: string, session: Session, notFoundMessage: string): void {
  if (resourceSessionId !== session.id) {
    throw new AppError("NOT_FOUND", notFoundMessage);
  }
}
