// TASK-B-012-r3（Jerry 2026-10-01 指示 2；2026-10-03 審查修正）：內容包層級指紋，依 recordId
// 排序的 (recordId, contentFingerprint) 清單算出。用來判斷「同一 packId 重新匯入時，內容是否真的
// 沒變」——規格字面是「每筆內容指紋都不變」（逐筆記錄的內容，不含 pack 本身的狀態或版號）。
//
// 2026-10-03 修正：原本連同 intendedKnowledgeVersion／status 一起納入雜湊，但 status 正是
// NEEDS_REVIEW → APPROVED 轉換時一定會變的欄位、intendedKnowledgeVersion 依
// contracts/knowledge/content-pack.schema.json 規則只有 APPROVED 時才會填（NEEDS_REVIEW 階段
// 必然是 null）——這兩個欄位納入雜湊會讓「升為 APPROVED」這個動作本身必然改變指紋，導致
// 「指紋不變才能升為 APPROVED」這條規則變成恆假、沒有任何一次核准升級能通過。版號若不一致，
// 由 compute_publish_plan 的 targetVersionId／TARGET_VERSION_CONFLICT 另外偵測與阻擋；pack 狀態
// 本身在 previewToken 的組成裡也是跟 packFingerprint 並列的獨立欄位（見 migration 0020 的
// pack 摘要字串 "packId:status:packFingerprint"），不需要也不應該重複烘進這個雜湊裡。
import { createHash } from "node:crypto";

export interface PackFingerprintRecord {
  recordId: string;
  contentFingerprint: string;
}

export function computePackFingerprint(records: PackFingerprintRecord[]): string {
  const sorted = [...records].sort((a, b) => a.recordId.localeCompare(b.recordId));
  const canonical = JSON.stringify({
    records: sorted.map((r) => ({ recordId: r.recordId, contentFingerprint: r.contentFingerprint })),
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
