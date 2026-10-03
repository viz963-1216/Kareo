// TASK-B-012：管理 Token 的發放與驗證，依 docs/API_CONTRACT.md §26.1、docs/ARCHITECTURE.md §20.8。
// 跟一般使用者 Session Token（sessionSecurityService.ts）是分開的憑證體系，不共用同一張表，
// 也不共用有效期／閒置延長規則——管理 token 固定 15 分鐘、沒有 lastSeenAt 的概念。
import { createHash, randomBytes } from "node:crypto";
import type { AdminKnowledgeRepository } from "../repositories/types.js";
import type { CreatedAdminSession, InternalOperator } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId } from "../lib/response.js";
import { hashOperatorKey } from "./internalOperatorService.js";

const ADMIN_TOKEN_TTL_MS = 15 * 60 * 1000;

export function generateAdminToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAdminToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// nowTaipeiISOString()（lib/response.ts）只接受「現在」，這裡需要「現在＋15 分鐘」，
// 用同樣的 +08:00 字面偏移量表示法自行算，避免額外依賴。
function taipeiISOString(date: Date): string {
  const taipei = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = taipei.getUTCFullYear();
  const mm = pad(taipei.getUTCMonth() + 1);
  const dd = pad(taipei.getUTCDate());
  const hh = pad(taipei.getUTCHours());
  const mi = pad(taipei.getUTCMinutes());
  const ss = pad(taipei.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// 依 API_CONTRACT §26.1：只接受 active 且 roles 含 KNOWLEDGE_PUBLISHER 的操作者；
// 不透露是 operatorId 不存在、密鑰錯誤還是角色不符（一律 SESSION_INVALID／FORBIDDEN 分兩層，
// 但訊息不重複使用者猜測哪一項）。
export async function createAdminSession(
  repo: AdminKnowledgeRepository,
  body: unknown
): Promise<{ adminToken: string; expiresAt: string }> {
  if (typeof body !== "object" || body === null) throw new AppError("INVALID_REQUEST", "請求格式錯誤。");
  const input = body as Record<string, unknown>;
  if (!isNonEmptyString(input.operatorId) || !isNonEmptyString(input.operatorKey)) {
    throw new AppError("VALIDATION_ERROR", "缺少 operatorId 或 operatorKey。");
  }

  const operator = await repo.findOperatorById(input.operatorId);
  if (!operator || !operator.active || operator.revokedAt !== null || hashOperatorKey(input.operatorKey) !== operator.keyHash) {
    throw new AppError("SESSION_INVALID", "操作者身分或密鑰無效。");
  }
  if (!operator.roles.includes("KNOWLEDGE_PUBLISHER")) {
    throw new AppError("FORBIDDEN", "操作者沒有知識發布權限。");
  }

  const now = new Date();
  const expiresAt = taipeiISOString(new Date(now.getTime() + ADMIN_TOKEN_TTL_MS));
  const adminToken = generateAdminToken();
  const session: CreatedAdminSession & { tokenHash: string } = {
    id: generateId("ADMSES"),
    operatorId: operator.id,
    adminToken,
    expiresAt,
    createdAt: taipeiISOString(now),
    tokenHash: hashAdminToken(adminToken),
  };
  await repo.createAdminSession(session);

  return { adminToken, expiresAt };
}

// 依 API_CONTRACT §26.1：X-Kareo-Admin-Token 驗證；過期／不存在一律 SESSION_INVALID，
// 有效但角色不符 FORBIDDEN。呼叫端（各 admin function handler）不需要自己重寫這套邏輯。
export async function requireAdminSession(
  repo: AdminKnowledgeRepository,
  adminTokenHeaderValue: unknown
): Promise<InternalOperator> {
  if (!isNonEmptyString(adminTokenHeaderValue)) {
    throw new AppError("SESSION_INVALID", "缺少或格式錯誤的 X-Kareo-Admin-Token。");
  }
  const session = await repo.findAdminSessionByTokenHash(hashAdminToken(adminTokenHeaderValue));
  if (!session) throw new AppError("SESSION_INVALID", "管理 Token 無效。");
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new AppError("SESSION_INVALID", "管理 Token 已過期。");
  }

  const operator = await repo.findOperatorById(session.operatorId);
  if (!operator || !operator.active || operator.revokedAt !== null) {
    throw new AppError("SESSION_INVALID", "操作者身分無效或已停用。");
  }
  if (!operator.roles.includes("KNOWLEDGE_PUBLISHER")) {
    throw new AppError("FORBIDDEN", "操作者沒有知識發布權限。");
  }
  return operator;
}
