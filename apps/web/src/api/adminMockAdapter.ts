import changesFixture from "../../../../contracts/mock/admin/knowledge-changes-response.json";
import dismissedFixture from "../../../../contracts/mock/admin/knowledge-change-dismissed-response.json";
import previewFixture from "../../../../contracts/mock/admin/knowledge-publish-preview-response.json";
import previewVersionExistsFixture from "../../../../contracts/mock/admin/knowledge-publish-preview-version-exists-response.json";
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
import changesEmptyFixture from "../../../../contracts/mock/admin/knowledge-changes-empty-response.json";
import recordsEmptyFixture from "../../../../contracts/mock/admin/knowledge-records-empty-response.json";
import previewBlockedFixture from "../../../../contracts/mock/admin/knowledge-publish-preview-no-approved-response.json";
import forbiddenFixture from "../../../../contracts/mock/admin/errors/forbidden-response.json";
import sessionInvalidFixture from "../../../../contracts/mock/admin/errors/session-invalid-response.json";
import validationFixture from "../../../../contracts/mock/admin/errors/validation-reason-required-response.json";
import stateChangedFixture from "../../../../contracts/mock/admin/errors/publish-preview-stale-response.json";
import restoreUnavailableFixture from "../../../../contracts/mock/admin/errors/republish-version-unavailable-response.json";
import type { AdminMockScenario } from "./mockScenarios";
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
let publishPreview = structuredClone(previewFixture.data) as AdminPublishPreview;

function resetMockState() {
  pendingChanges = structuredClone(changesFixture.data.changes) as AdminKnowledgeChange[];
  pendingRecords = structuredClone(recordsFixture.data.records) as AdminKnowledgeRecord[];
  knowledgeStatus = structuredClone(statusFixture.data) as AdminKnowledgeStatus;
  restorableVersions = structuredClone(restorableVersionsEmptyFixture.data) as AdminRestorableVersionsResponse;
  publishPreview = structuredClone(previewFixture.data) as AdminPublishPreview;
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

function fixtureError(fixture: { error: { code: string; message: string } }, status: number) {
  return new AdminMockError(fixture.error.code, fixture.error.message, status);
}

function readScenarioError(scenario?: AdminMockScenario) {
  if (scenario === "session-invalid") throw fixtureError(sessionInvalidFixture, 401);
  if (scenario === "forbidden") throw fixtureError(forbiddenFixture, 403);
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

  async getStatus(scenario?: AdminMockScenario): Promise<AdminKnowledgeStatus> {
    requireSession();
    await wait();
    readScenarioError(scenario);
    return structuredClone(knowledgeStatus);
  },
  async getChanges(scenario?: AdminMockScenario): Promise<AdminKnowledgeChange[]> {
    requireSession();
    await wait();
    readScenarioError(scenario);
    if (scenario === "empty") return structuredClone(changesEmptyFixture.data.changes) as AdminKnowledgeChange[];
    return structuredClone(pendingChanges);
  },
  async getRecords(scenario?: AdminMockScenario): Promise<AdminKnowledgeRecord[]> {
    requireSession();
    await wait();
    readScenarioError(scenario);
    if (scenario === "empty") return structuredClone(recordsEmptyFixture.data.records) as AdminKnowledgeRecord[];
    return structuredClone(pendingRecords);
  },
  async decideRecord(_recordId: string, body: AdminRecordDecisionRequest, scenario?: AdminMockScenario): Promise<AdminRecordDecisionResponse> {
    requireSession();
    requireConfirmedReason(body);
    await wait();
    if (scenario === "validation-error") throw fixtureError(validationFixture, 400);
    if (scenario === "state-changed") throw fixtureError(stateChangedFixture, 409);
    const fixture = body.decision === "APPROVED" ? approvedFixture : rejectedFixture;
    pendingRecords = pendingRecords.filter((record) => record.id !== _recordId);
    return structuredClone(fixture.data) as AdminRecordDecisionResponse;
  },
  async dismissChange(_changeId: string, body: AdminChangeDismissRequest, scenario?: AdminMockScenario): Promise<AdminChangeDismissResponse> {
    requireSession();
    requireConfirmedReason(body);
    await wait();
    if (scenario === "validation-error") throw fixtureError(validationFixture, 400);
    if (scenario === "state-changed") throw fixtureError(stateChangedFixture, 409);
    pendingChanges = pendingChanges.filter((change) => change.id !== _changeId);
    return structuredClone(dismissedFixture.data) as AdminChangeDismissResponse;
  },
  async getPublishPreview(scenario?: AdminMockScenario): Promise<AdminPublishPreview> {
    requireSession();
    await wait();
    readScenarioError(scenario);
    if (scenario === "publish-blocked" || scenario === "empty") return structuredClone(previewBlockedFixture.data) as AdminPublishPreview;
    return structuredClone(publishPreview);
  },
  async publish(body: AdminPublishRequest, scenario?: AdminMockScenario): Promise<AdminPublishResponse> {
    requireSession();
    if (body.confirm !== true) throw new AdminMockError("VALIDATION_ERROR", "請先確認發布操作。", 400);
    await wait();
    if (scenario === "validation-error") throw fixtureError(validationFixture, 400);
    if (scenario === "state-changed") throw fixtureError(stateChangedFixture, 409);
    knowledgeStatus = structuredClone(statusAfterPublishFixture.data) as AdminKnowledgeStatus;
    restorableVersions = structuredClone(restorableVersionsFixture.data) as AdminRestorableVersionsResponse;
    publishPreview = structuredClone(previewVersionExistsFixture.data) as AdminPublishPreview;
    return structuredClone(publishFixture.data) as AdminPublishResponse;
  },
  async getRestorableVersions(scenario?: AdminMockScenario): Promise<AdminRestorableVersionsResponse> {
    requireSession();
    await wait();
    readScenarioError(scenario);
    if (scenario === "empty") return structuredClone(restorableVersionsEmptyFixture.data) as AdminRestorableVersionsResponse;
    if (scenario === "no-current") return structuredClone(restorableVersionsNoCurrentFixture.data) as AdminRestorableVersionsResponse;
    return structuredClone(restorableVersions);
  },
  async withdraw(body: AdminWithdrawRequest, scenario?: AdminMockScenario): Promise<AdminWithdrawResponse> {
    requireSession();
    requireConfirmedReason(body);
    await wait();
    if (scenario === "validation-error") throw fixtureError(validationFixture, 400);
    if (scenario === "state-changed") throw fixtureError(stateChangedFixture, 409);
    if (scenario === "restore-unavailable") throw fixtureError(restoreUnavailableFixture, 409);
    const fixture = body.republishVersionId === null ? withdrawNoRepublishFixture : withdrawFixture;
    knowledgeStatus = body.republishVersionId === null
      ? structuredClone(statusNoPublishedFixture.data) as AdminKnowledgeStatus
      : structuredClone(statusFixture.data) as AdminKnowledgeStatus;
    restorableVersions = body.republishVersionId === null
      ? structuredClone(restorableVersionsNoCurrentFixture.data) as AdminRestorableVersionsResponse
      : structuredClone(restorableVersionsEmptyFixture.data) as AdminRestorableVersionsResponse;
    publishPreview = structuredClone(previewFixture.data) as AdminPublishPreview;
    return structuredClone(fixture.data) as AdminWithdrawResponse;
  },
};
