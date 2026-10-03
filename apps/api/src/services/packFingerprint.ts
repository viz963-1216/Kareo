// 內容包指紋（DATA_MODEL §26b），匯入（knowledgeImportService）與回填（backfillContentPacks）共用，
// 兩邊對同一份檔案必須算出相同的值。
//
// - computeRecordsFingerprint：只看逐筆內容（依 recordId 排序的 (recordId, contentFingerprint)），
//   用來判斷「同一 packId 重新匯入時，每筆內容指紋是否都不變」（§26b 規則；內容有變一律拒絕）。
// - computePackFingerprint：§26b 定義的 packFingerprint，上述清單再加上 intendedKnowledgeVersion、
//   status。審核時 Jerry 只能改 status／review／intendedKnowledgeVersion（contracts/knowledge/
//   README.md 第 22 行），所以升級為 APPROVED 會改變 packFingerprint，但不會改變 recordsFingerprint。
//
// 內容包中 status=REJECTED 的紀錄從不建立 KnowledgeRecord，也無法跟資料庫比對，兩個指紋都不納入。
import { createHash } from "node:crypto";

export interface PackFingerprintRecord {
  recordId: string;
  contentFingerprint: string;
  packStatus: string;
}

function canonicalRecords(records: PackFingerprintRecord[]): Array<{ recordId: string; contentFingerprint: string }> {
  return records
    .filter((r) => r.packStatus !== "REJECTED")
    .sort((a, b) => a.recordId.localeCompare(b.recordId))
    .map((r) => ({ recordId: r.recordId, contentFingerprint: r.contentFingerprint }));
}

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function computeRecordsFingerprint(records: PackFingerprintRecord[]): string {
  return sha256({ records: canonicalRecords(records) });
}

export function computePackFingerprint(
  records: PackFingerprintRecord[],
  intendedKnowledgeVersion: string | null,
  status: string
): string {
  return sha256({ records: canonicalRecords(records), intendedKnowledgeVersion, status });
}
