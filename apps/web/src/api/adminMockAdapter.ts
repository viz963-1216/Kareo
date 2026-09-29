import changesFixture from "../../../../contracts/mock/admin/knowledge-changes-response.json";
import dismissedFixture from "../../../../contracts/mock/admin/knowledge-change-dismissed-response.json";
import previewFixture from "../../../../contracts/mock/admin/knowledge-publish-preview-response.json";
import publishFixture from "../../../../contracts/mock/admin/knowledge-publish-response.json";
import approvedFixture from "../../../../contracts/mock/admin/knowledge-record-approved-response.json";
import rejectedFixture from "../../../../contracts/mock/admin/knowledge-record-rejected-response.json";
import recordsFixture from "../../../../contracts/mock/admin/knowledge-records-response.json";
import restorableVersionsFixture from "../../../../contracts/mock/admin/knowledge-restorable-versions-response.json";
import restorableVersionsEmptyFixture from "../../../../contracts/mock/admin/knowledge-restorable-versions-empty-response.json";
import restorableVersionsNoCurrentFixture from "../../../../contracts/mock/admin/knowledge-restorable-versions-no-current-response.json";
import statusAfterPublishFixture from "../../../../contracts/mock/admin/knowledge-status-after-publish-response.json";
import statusNoPublishedFixture from "../../../../contracts/mock/admin/knowledge-status-no-published-response.json";
import statusFixture from "../../../../contracts/mock/admin/knowledge-status-response.json";
import sessionFixture from "../../../../contracts/mock/admin/session-response.json";
import withdrawNoRepublishFixture from "../../../../contracts/mock/admin/knowledge-withdraw-no-republish-response.json";
import withdrawFixture from "../../../../contracts/mock/admin/knowledge-withdraw-response.json";
import type {
  AdminChangeDismissRequest,
  AdminChangeDismissResponse,
  AdminKnowledgeChange,
  AdminKnowledgeRecord,
  AdminKnowledgeStatus,
  AdminPublishPreview,
  AdminPublishRequest,
  AdminPublishResponse,
  AdminRecordDecisionRequest,
  AdminRecordDecisionResponse,
  AdminRestorableVersionsResponse,
  AdminSessionResponse,
  AdminWithdrawRequest,
  AdminWithdrawResponse,
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
let pendingChanges = structuredClone(changesFixture.data.changes) as AdminKnowledgeChange[];
let pendingRecords = structuredClone(recordsFixture.data.records) as AdminKnowledgeRecord[];
let knowledgeStatus = structuredClone(statusFixture.data) as AdminKnowledgeStatus;
let restorableVersions = structuredClone(restorableVersionsEmptyFixture.data) as AdminRestorableVersionsResponse;

function resetMockState() {
  pendingChanges = structuredClone(changesFixture.data.changes) as AdminKnowledgeChange[];
  pendingRecords = structuredClone(recordsFixture.data.records) as AdminKnowledgeRecord[];
  knowledgeStatus = structuredClone(statusFixture.data) as AdminKnowledgeStatus;
  restorableVersions = structuredClone(restorableVersionsEmptyFixture.data) as AdminRestorableVersionsResponse;
}

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

function requireConfirmedReason(body: { confirm: true; reason: string }) {
  if (body.confirm !== true) throw new AdminMockError("VALIDATION_ERROR", "請先確認此操作。", 400);
  const reasonLength = body.reason.trim().length;
  if (reasonLength < 1 || reasonLength > 500) throw new AdminMockError("VALIDATION_ERROR", "原因必須為 1 至 500 字。", 400);
}

export const adminMockApi = {
  hasSession: () => Boolean(storage()?.getItem(ADMIN_TOKEN_KEY)),
  logout: () => storage()?.removeItem(ADMIN_TOKEN_KEY),

  async login(operatorId: string, operatorKey: string): Promise<AdminSessionResponse> {
    await wait();
    if (!operatorId.trim() || !operatorKey) throw new AdminMockError("VALIDATION_ERROR", "請輸入操作者 ID 與密鑰。", 400);
    const session = structuredClone(sessionFixture.data) as AdminSessionResponse;
    resetMockState();
    storage()?.setItem(ADMIN_TOKEN_KEY, session.adminToken);
    return session;
  },

  async getStatus(): Promise<AdminKnowledgeStatus> {
    requireSession();
    await wait();
    return structuredClone(knowledgeStatus);
  },
  async getChanges(): Promise<AdminKnowledgeChange[]> {
    requireSession();
    await wait();
    return structuredClone(pendingChanges);
  },
  async getRecords(): Promise<AdminKnowledgeRecord[]> {
    requireSession();
    await wait();
    return structuredClone(pendingRecords);
  },
  async decideRecord(_recordId: string, body: AdminRecordDecisionRequest): Promise<AdminRecordDecisionResponse> {
    requireSession();
    requireConfirmedReason(body);
    await wait();
    const fixture = body.decision === "APPROVED" ? approvedFixture : rejectedFixture;
    pendingRecords = pendingRecords.filter((record) => record.id !== _recordId);
    return structuredClone(fixture.data) as AdminRecordDecisionResponse;
  },
  async dismissChange(_changeId: string, body: AdminChangeDismissRequest): Promise<AdminChangeDismissResponse> {
    requireSession();
    requireConfirmedReason(body);
    await wait();
    pendingChanges = pendingChanges.filter((change) => change.id !== _changeId);
    return structuredClone(dismissedFixture.data) as AdminChangeDismissResponse;
  },
  async getPublishPreview(): Promise<AdminPublishPreview> {
    requireSession();
    await wait();
    return structuredClone(previewFixture.data) as AdminPublishPreview;
  },
  async publish(body: AdminPublishRequest): Promise<AdminPublishResponse> {
    requireSession();
    if (body.confirm !== true) throw new AdminMockError("VALIDATION_ERROR", "請先確認發布操作。", 400);
    await wait();
    knowledgeStatus = structuredClone(statusAfterPublishFixture.data) as AdminKnowledgeStatus;
    restorableVersions = structuredClone(restorableVersionsFixture.data) as AdminRestorableVersionsResponse;
    return structuredClone(publishFixture.data) as AdminPublishResponse;
  },
  async getRestorableVersions(): Promise<AdminRestorableVersionsResponse> {
    requireSession();
    await wait();
    return structuredClone(restorableVersions);
  },
  async withdraw(body: AdminWithdrawRequest): Promise<AdminWithdrawResponse> {
    requireSession();
    requireConfirmedReason(body);
    await wait();
    const fixture = body.republishVersionId === null ? withdrawNoRepublishFixture : withdrawFixture;
    knowledgeStatus = body.republishVersionId === null
      ? structuredClone(statusNoPublishedFixture.data) as AdminKnowledgeStatus
      : structuredClone(statusFixture.data) as AdminKnowledgeStatus;
    restorableVersions = body.republishVersionId === null
      ? structuredClone(restorableVersionsNoCurrentFixture.data) as AdminRestorableVersionsResponse
      : structuredClone(restorableVersionsEmptyFixture.data) as AdminRestorableVersionsResponse;
    return structuredClone(fixture.data) as AdminWithdrawResponse;
  },
};
