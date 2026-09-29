import changesFixture from "../../../../contracts/mock/admin/knowledge-changes-response.json";
import recordsFixture from "../../../../contracts/mock/admin/knowledge-records-response.json";
import statusFixture from "../../../../contracts/mock/admin/knowledge-status-response.json";
import sessionFixture from "../../../../contracts/mock/admin/session-response.json";
import type {
  AdminKnowledgeChange,
  AdminKnowledgeRecord,
  AdminKnowledgeStatus,
  AdminSessionResponse,
} from "../types/api";

class AdminMockError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const ADMIN_TOKEN_KEY = "kareo.adminToken";
const wait = () => new Promise((resolve) => globalThis.setTimeout(resolve, 350));

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function requireSession() {
  if (!storage()?.getItem(ADMIN_TOKEN_KEY)) {
    throw new AdminMockError("SESSION_INVALID", "管理工作階段已失效，請重新登入。", 401);
  }
}

export const adminMockApi = {
  hasSession: () => Boolean(storage()?.getItem(ADMIN_TOKEN_KEY)),
  logout: () => storage()?.removeItem(ADMIN_TOKEN_KEY),

  async login(operatorId: string, operatorKey: string): Promise<AdminSessionResponse> {
    await wait();
    if (!operatorId.trim() || !operatorKey) throw new AdminMockError("VALIDATION_ERROR", "請輸入操作者 ID 與密鑰。", 400);
    const session = structuredClone(sessionFixture.data) as AdminSessionResponse;
    storage()?.setItem(ADMIN_TOKEN_KEY, session.adminToken);
    return session;
  },

  async getStatus(): Promise<AdminKnowledgeStatus> {
    requireSession();
    await wait();
    return structuredClone(statusFixture.data) as AdminKnowledgeStatus;
  },
  async getChanges(): Promise<AdminKnowledgeChange[]> {
    requireSession();
    await wait();
    return structuredClone(changesFixture.data.changes) as AdminKnowledgeChange[];
  },
  async getRecords(): Promise<AdminKnowledgeRecord[]> {
    requireSession();
    await wait();
    return structuredClone(recordsFixture.data.records) as AdminKnowledgeRecord[];
  },
};
