// TASK-B-012-r3（Jerry 2026-10-01 指示 2）：內容包層級指紋，依 recordId 排序的
// (recordId, contentFingerprint) 清單，加上版號與狀態算出。用來判斷「同一 packId 重新匯入時，
// 內容是否真的沒變」——沒變才允許 NEEDS_REVIEW → APPROVED；變了一律拒絕，要求新 packId。
import { createHash } from "node:crypto";

export interface PackFingerprintRecord {
  recordId: string;
  contentFingerprint: string;
}

export function computePackFingerprint(
  records: PackFingerprintRecord[],
  intendedKnowledgeVersion: string,
  status: string
): string {
  const sorted = [...records].sort((a, b) => a.recordId.localeCompare(b.recordId));
  const canonical = JSON.stringify({
    records: sorted.map((r) => ({ recordId: r.recordId, contentFingerprint: r.contentFingerprint })),
    intendedKnowledgeVersion,
    status,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
