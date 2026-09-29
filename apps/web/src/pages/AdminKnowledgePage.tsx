import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../api";
import { NoIndex } from "../components/NoIndex";
import type { AdminKnowledgeChange, AdminKnowledgeRecord, AdminKnowledgeStatus } from "../types/api";

type ViewStatus = "checking" | "logged-out" | "loading" | "ready" | "error";
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
  const [view, setView] = useState<ViewStatus>("checking");
  const [operatorId, setOperatorId] = useState("");
  const [operatorKey, setOperatorKey] = useState("");
  const [status, setStatus] = useState<AdminKnowledgeStatus | null>(null);
  const [changes, setChanges] = useState<AdminKnowledgeChange[]>([]);
  const [records, setRecords] = useState<AdminKnowledgeRecord[]>([]);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const loadingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setView("loading");
    setMessage("");
    try {
      const [nextStatus, nextChanges, nextRecords] = await Promise.all([
        adminApi.getStatus(),
        adminApi.getChanges(),
        adminApi.getRecords(),
      ]);
      setStatus(nextStatus);
      setChanges(nextChanges);
      setRecords(nextRecords);
      setView("ready");
    } catch (reason) {
      if (errorCode(reason) === "SESSION_INVALID" || errorCode(reason) === "FORBIDDEN") {
        await adminApi.logout();
        setMessage(reason instanceof Error ? reason.message : "管理工作階段已失效，請重新登入。");
        setView("logged-out");
      } else {
        setMessage(reason instanceof Error ? reason.message : "目前無法取得知識管理資料，請稍後再試。");
        setView("error");
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

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
    if (view === "error") errorRef.current?.focus();
  }, [view]);

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
        await adminApi.decideRecord(reviewAction.record.id, {
          decision: reviewAction.decision,
          reason,
          expectedContentFingerprint: reviewAction.record.contentFingerprint,
          confirm: true,
        });
        setNotice(reviewAction.decision === "APPROVED" ? "紀錄已核准。" : "紀錄已拒絕。"
        );
      } else {
        await adminApi.dismissChange(reviewAction.change.id, { reason, confirm: true });
        setNotice("每日變更已標記為忽略。此操作已留下稽核紀錄。");
      }
      setReviewAction(null);
      setReviewReason("");
      setReviewConfirmed(false);
      await loadDashboard();
    } catch (reasonValue) {
      const code = errorCode(reasonValue);
      if (code === "SESSION_INVALID" || code === "FORBIDDEN") {
        await adminApi.logout();
        setMessage(reasonValue instanceof Error ? reasonValue.message : "管理工作階段已失效，請重新登入。");
        setView("logged-out");
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

          <section className="admin-section" aria-labelledby="knowledge-changes-title">
            <h2 id="knowledge-changes-title">每日變更</h2>
            {changes.length === 0 ? <p className="panel empty-state" role="status">目前沒有待檢視的每日變更。</p> : (
              <div className="admin-list">
                {changes.map((change) => (
                  <article className="panel" key={change.id}>
                    <h3>{change.sourceId}</h3>
                    <p>{change.diffSummary}</p>
                    <p className="supporting-text">偵測時間：{dateTime(change.detectedAt)}</p>
                    <button className="button secondary" type="button" disabled={reviewBusy} onClick={() => beginReview({ kind: "change", change })}>忽略此次變更</button>
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
                      <button className="button secondary" type="button" disabled={reviewBusy} onClick={() => beginReview({ kind: "record", record, decision: "REJECTED" })}>拒絕</button>
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
