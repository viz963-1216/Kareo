import { Link, useLocation } from "react-router-dom";

type EndedState =
  | { kind: "restarted" }
  | { kind: "deleted"; deletionScheduledBefore: string }
  | { kind: "withdrawn"; withdrawnAt: string };

function readState(value: unknown): EndedState | null {
  if (typeof value !== "object" || value === null) return null;
  const state = value as Record<string, unknown>;
  if (state.kind === "restarted") return { kind: "restarted" };
  if (state.kind === "deleted" && typeof state.deletionScheduledBefore === "string") {
    return { kind: "deleted", deletionScheduledBefore: state.deletionScheduledBefore };
  }
  if (state.kind === "withdrawn" && typeof state.withdrawnAt === "string") return { kind: "withdrawn", withdrawnAt: state.withdrawnAt };
  return null;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
}

export function SessionEndedPage() {
  const state = readState(useLocation().state);
  return (
    <main id="main-content" className="content">
      <p className="eyebrow">使用階段</p>
      {state?.kind === "deleted" ? (
        <>
          <h1>已送出刪除要求</h1>
          <p role="status">
            平台已收到刪除要求，這次的使用階段已失效。評估與推薦資料將於 {formatDate(state.deletionScheduledBefore)} 前刪除；已送出的媒合需求會取消，聯絡資料會清空。
          </p>
        </>
      ) : state?.kind === "withdrawn" ? (
        <>
          <h1>已撤回同意</h1>
          <p role="status">
            平台已於 {formatDate(state.withdrawnAt)} 收到撤回，這次的使用階段已失效，資料已進入刪除流程；已送出的媒合需求會取消。
          </p>
        </>
      ) : (
        <>
          <h1>已重新開始</h1>
          <p role="status">
            已清除這個瀏覽器分頁上的畫面資料。這<strong>不代表</strong>平台上的評估資料已刪除；如需刪除，請在完成評估後的結果頁使用「刪除我的評估資料」。
          </p>
        </>
      )}
      <Link className="button primary" to="/consent">開始新的評估</Link>
    </main>
  );
}
