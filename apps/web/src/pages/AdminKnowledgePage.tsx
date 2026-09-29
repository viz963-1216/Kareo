import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "../api";
import { ADMIN_MOCK_SCENARIOS, type AdminMockScenario } from "../api/mockScenarios";
import { NoIndex } from "../components/NoIndex";
import type {
  AdminKnowledgeChange,
  AdminKnowledgeRecord,
  AdminKnowledgeStatus,
  AdminPublishPreview,
  AdminRestorableVersionsResponse,
} from "../types/api";

type ViewStatus = "checking" | "logged-out" | "loading" | "ready" | "forbidden" | "error";
type ReviewAction =
  | { kind: "record"; record: AdminKnowledgeRecord; decision: "APPROVED" | "REJECTED" }
  | { kind: "change"; change: AdminKnowledgeChange }
  | null;

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value)) : "尚無資料";

const crawlerLabels: Record<string, string> = {
  RUNNING: "執行中",
  SUCCESS: "成功",
  PARTIAL: "部分完成",
  FAILED: "失敗",
};

const jurisdictionLabels: Record<AdminKnowledgeRecord["jurisdiction"], string> = {
  TAIWAN: "全國",
  TAIPEI: "臺北市",
  NEW_TAIPEI: "新北市",
};

function errorCode(reason: unknown) {
  return typeof reason === "object" && reason !== null && "code" in reason
    && typeof (reason as { code?: unknown }).code === "string"
    ? (reason as { code: string }).code
    : null;
}

export function AdminKnowledgePage() {
  const [searchParams] = useSearchParams();
  const requestedScenario = searchParams.get("adminMock");
  const mockScenario: AdminMockScenario | undefined = ADMIN_MOCK_SCENARIOS.find((scenario) => scenario === requestedScenario);
  const [view, setView] = useState<ViewStatus>("checking");
  const [operatorId, setOperatorId] = useState("");
  const [operatorKey, setOperatorKey] = useState("");
  const [status, setStatus] = useState<AdminKnowledgeStatus | null>(null);
  const [changes, setChanges] = useState<AdminKnowledgeChange[]>([]);
  const [records, setRecords] = useState<AdminKnowledgeRecord[]>([]);
  const [preview, setPreview] = useState<AdminPublishPreview | null>(null);
  const [restorable, setRestorable] = useState<AdminRestorableVersionsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [republishVersionId, setRepublishVersionId] = useState("");
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const loadingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setView("loading");
    setMessage("");
    try {
      const [nextStatus, nextChanges, nextRecords, nextPreview, nextRestorable] = await Promise.all([
        adminApi.getStatus(mockScenario),
        adminApi.getChanges(mockScenario),
        adminApi.getRecords(mockScenario),
        adminApi.getPublishPreview(mockScenario),
        adminApi.getRestorableVersions(mockScenario),
      ]);
      setStatus(nextStatus);
      setChanges(nextChanges);
      setRecords(nextRecords);
      setPreview(nextPreview);
      setRestorable(nextRestorable);
      setView("ready");
    } catch (reason) {
      if (errorCode(reason) === "SESSION_INVALID") {
        await adminApi.logout();
        setMessage(reason instanceof Error ? reason.message : "管理工作階段已失效，請重新登入。");
        setView("logged-out");
      } else if (errorCode(reason) === "FORBIDDEN") {
        await adminApi.logout();
        setMessage(reason instanceof Error ? reason.message : "此操作者沒有知識發布權限。");
        setView("forbidden");
      } else {
        setMessage(reason instanceof Error ? reason.message : "目前無法取得知識管理資料，請稍後再試。");
        setView("error");
      }
    } finally {
      loadingRef.current = false;
    }
  }, [mockScenario]);

  useEffect(() => {
    let active = true;
    adminApi.hasSession().then((hasSession) => {
      if (!active) return;
      if (hasSession) void loadDashboard();
      else setView("logged-out");
    });
    return () => { active = false; };
  }, [loadDashboard]);

  useEffect(() => {
    if (view === "error" || view === "forbidden") errorRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (!republishVersionId) return;
    const remainsRestorable = restorable?.versions.some((version) => version.versionId === republishVersionId) ?? false;
    if (!remainsRestorable) {
      setRepublishVersionId("");
      setWithdrawConfirmed(false);
    }
  }, [republishVersionId, restorable]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (loadingRef.current) return;
    if (!operatorId.trim() || !operatorKey) {
      setMessage("請輸入操作者 ID 與密鑰。");
      return;
    }
    loadingRef.current = true;
    setMessage("");
    setView("loading");
    try {
      await adminApi.login(operatorId.trim(), operatorKey);
      setOperatorKey("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "登入失敗，請確認資料後再試。");
      setView("logged-out");
      loadingRef.current = false;
      return;
    }
    loadingRef.current = false;
    await loadDashboard();
  }

  async function logout() {
    await adminApi.logout();
    setStatus(null);
    setChanges([]);
    setRecords([]);
    setOperatorId("");
    setOperatorKey("");
    setMessage("");
    setView("logged-out");
  }

  function beginReview(action: Exclude<ReviewAction, null>) {
    setReviewAction(action);
    setReviewReason("");
    setReviewConfirmed(false);
    setNotice("");
  }

  function cancelReview() {
    if (reviewBusy) return;
    setReviewAction(null);
    setReviewReason("");
    setReviewConfirmed(false);
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!reviewAction || reviewBusy) return;
    const reason = reviewReason.trim();
    if (reason.length < 1 || reason.length > 500 || !reviewConfirmed) return;
    setReviewBusy(true);
    setNotice("");
    try {
      if (reviewAction.kind === "record") {
        const result = await adminApi.decideRecord(reviewAction.record.id, {
          decision: reviewAction.decision,
          reason,
          expectedContentFingerprint: reviewAction.record.contentFingerprint,
          confirm: true,
        }, mockScenario);
        setNotice(result.record.status === "APPROVED"
          ? `「${result.record.title}」已核准。`
          : `「${result.record.title}」已退回。`);
      } else {
        const result = await adminApi.dismissChange(reviewAction.change.id, { reason, confirm: true }, mockScenario);
        setNotice(`來源 ${result.change.sourceId} 的本次變更已標記為不影響內容。`);
      }
      setReviewAction(null);
      setReviewReason("");
      setReviewConfirmed(false);
      await loadDashboard();
    } catch (reasonValue) {
      const code = errorCode(reasonValue);
      if (code === "SESSION_INVALID") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "管理工作階段已失效，請重新登入。");
        setView("logged-out");
        setReviewAction(null);
      } else if (code === "FORBIDDEN") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "此操作者沒有知識發布權限。");
        setView("forbidden");
        setReviewAction(null);
      } else if (code === "KNOWLEDGE_STATE_CHANGED" || code === "INVALID_STATUS_TRANSITION") {
        setNotice("資料狀態已更新，已重新載入最新內容。請重新檢查後再次操作。");
        setReviewAction(null);
        await loadDashboard();
      } else {
        setNotice(reasonValue instanceof Error ? reasonValue.message : "操作失敗，請稍後再試。");
      }
    } finally {
      setReviewBusy(false);
    }
  }

  async function submitPublish(event: FormEvent) {
    event.preventDefault();
    if (!preview?.canPublish || !preview.targetVersionId || !preview.previewToken || !publishConfirmed || releaseBusy) return;
    setReleaseBusy(true);
    setNotice("");
    try {
      const result = await adminApi.publish({ versionId: preview.targetVersionId, previewToken: preview.previewToken, confirm: true }, mockScenario);
      setPublishConfirmed(false);
      setNotice(`版本 ${result.versionId} 已於 ${dateTime(result.publishedAt)}發布，共 ${result.totalRecordCount} 筆紀錄。`);
      await loadDashboard();
    } catch (reasonValue) {
      const code = errorCode(reasonValue);
      if (code === "SESSION_INVALID") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "管理工作階段已失效，請重新登入。");
        setView("logged-out");
      } else if (code === "FORBIDDEN") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "此操作者沒有知識發布權限。");
        setView("forbidden");
      } else if (code === "KNOWLEDGE_STATE_CHANGED" || code === "INVALID_STATUS_TRANSITION") {
        setPublishConfirmed(false);
        setNotice("發布狀態已改變，已更新預覽；請重新核對後再次確認。");
        await loadDashboard();
      } else {
        setNotice(reasonValue instanceof Error ? reasonValue.message : "發布失敗，請稍後再試。");
      }
    } finally {
      setReleaseBusy(false);
    }
  }

  async function submitWithdraw(event: FormEvent) {
    event.preventDefault();
    const currentVersion = restorable?.currentVersion?.versionId;
    const reason = withdrawReason.trim();
    const selectedRepublishVersion = republishVersionId || null;
    const selectionIsCurrent = selectedRepublishVersion === null
      || Boolean(restorable?.versions.some((version) => version.versionId === selectedRepublishVersion));
    if (!selectionIsCurrent) {
      setRepublishVersionId("");
      setWithdrawConfirmed(false);
      setNotice("可恢復版本清單已更新，請重新選擇並確認。");
      return;
    }
    if (!currentVersion || reason.length < 1 || reason.length > 500 || !withdrawConfirmed || releaseBusy) return;
    setReleaseBusy(true);
    setNotice("");
    try {
      const result = await adminApi.withdraw({
        withdrawVersionId: currentVersion,
        republishVersionId: selectedRepublishVersion,
        reason,
        confirm: true,
      }, mockScenario);
      setWithdrawReason("");
      setWithdrawConfirmed(false);
      setNotice(result.republishedVersionId
        ? `版本 ${result.withdrawnVersionId} 已撤回，現在使用 ${result.republishedVersionId}。`
        : `版本 ${result.withdrawnVersionId} 已撤回，目前沒有已發布知識版本。`);
      await loadDashboard();
    } catch (reasonValue) {
      const code = errorCode(reasonValue);
      if (code === "SESSION_INVALID") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "管理工作階段已失效，請重新登入。");
        setView("logged-out");
      } else if (code === "FORBIDDEN") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "此操作者沒有知識發布權限。");
        setView("forbidden");
      } else if (code === "KNOWLEDGE_STATE_CHANGED" || code === "INVALID_STATUS_TRANSITION") {
        setWithdrawConfirmed(false);
        setNotice("版本狀態已改變，已重新載入；請再次選擇並確認。");
        await loadDashboard();
      } else {
        setNotice(reasonValue instanceof Error ? reasonValue.message : "撤回失敗，請稍後再試。");
      }
    } finally {
      setReleaseBusy(false);
    }
  }

  return (
    <main id="main-content" className="content admin-page" aria-busy={view === "checking" || view === "loading"}>
      <NoIndex />
      <p className="eyebrow">內部知識管理</p>
      <h1>知識審核與發布</h1>

      {(view === "checking" || view === "loading") && (
        <p className="loading" role="status">正在安全地載入管理頁面，請稍候。</p>
      )}

      {view === "logged-out" && (
        <section className="admin-login" aria-labelledby="admin-login-title">
          <h2 id="admin-login-title">管理員登入</h2>
          <p>本頁只供授權的知識發布人員使用。登入資料不會保存在網址或瀏覽器長期儲存空間。</p>
          {message && <div className="error" role="alert"><p>{message}</p></div>}
          <form className="stack" onSubmit={login} noValidate>
            <label>
              操作者 ID
              <input autoComplete="username" value={operatorId} onChange={(event) => setOperatorId(event.target.value)} />
            </label>
            <label>
              操作者密鑰
              <input type="password" autoComplete="current-password" value={operatorKey} onChange={(event) => setOperatorKey(event.target.value)} />
            </label>
            <button className="button primary" type="submit">登入管理頁</button>
          </form>
        </section>
      )}

      {view === "error" && (
        <section className="error" role="alert" tabIndex={-1} ref={errorRef}>
          <h2>暫時無法載入管理資料</h2>
          <p>{message}</p>
          <button className="button primary" type="button" onClick={() => void loadDashboard()}>再試一次</button>
        </section>
      )}

      {view === "forbidden" && (
        <section className="error" role="alert" tabIndex={-1} ref={errorRef}>
          <h2>沒有管理權限</h2>
          <p>{message}</p>
          <button className="button secondary" type="button" onClick={() => setView("logged-out")}>返回管理員登入</button>
        </section>
      )}

      {view === "ready" && status && (
        <>
          <div className="admin-heading-actions">
            <p>所有變更均需填寫原因並再次確認，系統會保留稽核紀錄。</p>
            <button className="button secondary" type="button" onClick={() => void logout()}>登出</button>
          </div>

          {notice && <div className="notice" role="status"><p>{notice}</p></div>}

          {reviewAction && (
            <section className="panel admin-confirm" aria-labelledby="admin-confirm-title">
              <h2 id="admin-confirm-title">確認管理操作</h2>
              <p>
                {reviewAction.kind === "record"
                  ? `即將${reviewAction.decision === "APPROVED" ? "核准" : "拒絕"}「${reviewAction.record.title}」。`
                  : `即將忽略「${reviewAction.change.sourceId}」的本次變更。`}
              </p>
              <form className="stack" onSubmit={submitReview}>
                <label>
                  原因（1–500 字）
                  <textarea
                    rows={4}
                    maxLength={500}
                    required
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                  />
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />
                  我已核對來源與內容，確認執行此操作
                </label>
                <div className="admin-action-row">
                  <button className="button primary" type="submit" disabled={reviewBusy || !reviewConfirmed || reviewReason.trim().length < 1}>
                    {reviewBusy ? "處理中…" : "確認執行"}
                  </button>
                  <button className="button secondary" type="button" disabled={reviewBusy} onClick={cancelReview}>取消</button>
                </div>
              </form>
            </section>
          )}

          <section className="panel" aria-labelledby="knowledge-status-title">
            <h2 id="knowledge-status-title">目前狀態</h2>
            <dl className="admin-facts">
              <div><dt>已發布版本</dt><dd>{status.publishedVersion ?? "尚無已發布版本"}</dd></div>
              <div><dt>發布時間</dt><dd>{dateTime(status.publishedAt)}</dd></div>
              <div><dt>每日檢查</dt><dd>{status.lastCrawlerRun ? crawlerLabels[status.lastCrawlerRun.status] ?? status.lastCrawlerRun.status : "尚無執行紀錄"}</dd></div>
              <div><dt>開始時間</dt><dd>{dateTime(status.lastCrawlerRun?.startedAt ?? null)}</dd></div>
              <div><dt>完成時間</dt><dd>{dateTime(status.lastCrawlerRun?.finishedAt ?? null)}</dd></div>
            </dl>
          </section>

          {preview && (
            <section className="admin-section panel" aria-labelledby="knowledge-publish-title">
              <h2 id="knowledge-publish-title">發布預覽</h2>
              <dl className="admin-facts compact">
                <div><dt>目標版本</dt><dd>{preview.targetVersionId ?? "尚未產生"}</dd></div>
                <div><dt>本次新增</dt><dd>{preview.publishedRecordCount} 筆</dd></div>
                <div><dt>沿用紀錄</dt><dd>{preview.carriedForwardCount} 筆</dd></div>
                <div><dt>發布後總數</dt><dd>{preview.totalRecordCount} 筆</dd></div>
                {preview.supersededRecordCount > 0 && <div><dt>取代紀錄</dt><dd>{preview.supersededRecordCount} 筆</dd></div>}
                {preview.excludedRecordCount > 0 && <div><dt>排除紀錄</dt><dd>{preview.excludedRecordCount} 筆</dd></div>}
              </dl>
              {preview.blockers.length > 0 && (
                <div className="error" role="alert">
                  <h3>目前無法發布</h3>
                  <ul>{preview.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul>
                </div>
              )}
              <form className="stack" onSubmit={submitPublish}>
                <label className="check-row">
                  <input type="checkbox" checked={publishConfirmed} disabled={!preview.canPublish} onChange={(event) => setPublishConfirmed(event.target.checked)} />
                  我已核對發布預覽，確認發布此不可覆寫的新版本
                </label>
                <button className="button primary" type="submit" disabled={!preview.canPublish || !preview.previewToken || !publishConfirmed || releaseBusy}>
                  {releaseBusy ? "處理中…" : "確認發布"}
                </button>
              </form>
            </section>
          )}

          {restorable && (
            <section className="admin-section panel" aria-labelledby="knowledge-withdraw-title">
              <h2 id="knowledge-withdraw-title">撤回已發布版本</h2>
              <p>目前版本：{restorable.currentVersion?.versionId ?? "目前沒有已發布版本"}</p>
              {!restorable.currentVersion && <p className="supporting-text" role="status">目前沒有可撤回的已發布版本，撤回操作已停用。</p>}
              <form className="stack" onSubmit={submitWithdraw}>
                <label>
                  撤回後狀態
                  <select disabled={!restorable.currentVersion} value={republishVersionId} onChange={(event) => setRepublishVersionId(event.target.value)}>
                    <option value="">不重新發布任何版本</option>
                    {restorable.versions.map((version) => <option key={version.versionId} value={version.versionId}>重新發布 {version.versionId}</option>)}
                  </select>
                </label>
                {restorable.currentVersion && !republishVersionId && <p className="error" role="alert">警告：撤回後可能沒有任何已發布知識，使用者評估將暫停。</p>}
                <label>
                  撤回原因（1–500 字）
                  <textarea disabled={!restorable.currentVersion} rows={4} maxLength={500} required value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} />
                </label>
                <label className="check-row">
                  <input type="checkbox" disabled={!restorable.currentVersion} checked={withdrawConfirmed} onChange={(event) => setWithdrawConfirmed(event.target.checked)} />
                  我了解撤回影響，確認執行此操作
                </label>
                <button className="button secondary" type="submit" disabled={!restorable.currentVersion || !withdrawConfirmed || withdrawReason.trim().length < 1 || releaseBusy}>
                  {releaseBusy ? "處理中…" : "確認撤回"}
                </button>
              </form>
            </section>
          )}

          <section className="admin-section" aria-labelledby="knowledge-changes-title">
            <h2 id="knowledge-changes-title">每日變更</h2>
            {changes.length === 0 ? <p className="panel empty-state" role="status">目前沒有待檢視的每日變更。</p> : (
              <div className="admin-list">
                {changes.map((change) => (
                  <article className="panel" key={change.id}>
                    <h3>{change.sourceId}</h3>
                    <p>{change.diffSummary}</p>
                    <p className="supporting-text">偵測時間：{dateTime(change.detectedAt)}</p>
                    <button className="button secondary" type="button" disabled={reviewBusy} onClick={() => beginReview({ kind: "change", change })}>不影響內容</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section" aria-labelledby="knowledge-records-title">
            <h2 id="knowledge-records-title">待核准紀錄</h2>
            {records.length === 0 ? <p className="panel empty-state" role="status">目前沒有待核准紀錄。</p> : (
              <div className="admin-list">
                {records.map((record) => (
                  <article className="panel" key={record.id}>
                    <h3>{record.title}</h3>
                    <dl className="admin-facts compact">
                      <div><dt>適用地區</dt><dd>{jurisdictionLabels[record.jurisdiction]}</dd></div>
                      <div><dt>分類</dt><dd>{record.category}</dd></div>
                      <div><dt>生效日</dt><dd>{record.effectiveFrom ?? "未提供"}</dd></div>
                    </dl>
                    <p>{record.summary}</p>
                    <a href={record.sourceUrl} target="_blank" rel="noreferrer">查看官方來源（另開新分頁）</a>
                    <div className="admin-action-row">
                      <button className="button primary" type="button" disabled={reviewBusy} onClick={() => beginReview({ kind: "record", record, decision: "APPROVED" })}>核准</button>
                      <button className="button secondary" type="button" disabled={reviewBusy} onClick={() => beginReview({ kind: "record", record, decision: "REJECTED" })}>退回</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
