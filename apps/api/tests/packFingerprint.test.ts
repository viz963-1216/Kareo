import { describe, it, expect } from "vitest";
import { computePackFingerprint, computeRecordsFingerprint } from "../src/services/packFingerprint.js";

// DATA_MODEL §26b：packFingerprint = 依 recordId 排序的 (recordId, contentFingerprint) + intendedKnowledgeVersion
// + status；recordsFingerprint 只含逐筆內容，用來判斷同一 packId 內容是否改變。兩者都包含內容包中的
// REJECTED 紀錄（D-16c：匯入與回填使用相同紀錄集合與算法）。
const rec = (recordId: string, contentFingerprint: string) => ({ recordId, contentFingerprint });

describe("computeRecordsFingerprint (content identity)", () => {
  it("same records give the same value regardless of order", () => {
    const forward = [rec("KR-2026-001", "sha256:aaa"), rec("KR-2026-002", "sha256:bbb")];
    expect(computeRecordsFingerprint(forward)).toBe(computeRecordsFingerprint([...forward].reverse()));
    expect(computeRecordsFingerprint(forward)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("a changed, added or removed record changes the value", () => {
    const base = [rec("KR-2026-001", "sha256:aaa")];
    expect(computeRecordsFingerprint(base)).not.toBe(computeRecordsFingerprint([rec("KR-2026-001", "sha256:zzz")]));
    expect(computeRecordsFingerprint(base)).not.toBe(computeRecordsFingerprint([...base, rec("KR-2026-002", "sha256:bbb")]));
  });

  it("does not take pack status / intendedKnowledgeVersion (promotion keeps content identity)", () => {
    expect(computeRecordsFingerprint.length).toBe(1);
    const records = [rec("KR-2026-001", "sha256:aaa")];
    expect(computeRecordsFingerprint(records)).toBe(computeRecordsFingerprint(records.map((r) => ({ ...r }))));
  });

  it("includes REJECTED records: changing a rejected record's content changes the value (D-16c)", () => {
    const approved = rec("KR-2026-001", "sha256:aaa");
    const withRejected = [approved, rec("KR-2026-002", "sha256:rejected")];
    expect(computeRecordsFingerprint(withRejected)).not.toBe(computeRecordsFingerprint([approved]));
    expect(computeRecordsFingerprint(withRejected)).not.toBe(computeRecordsFingerprint([approved, rec("KR-2026-002", "sha256:rejected-edited")]));
  });
});

describe("computePackFingerprint (DATA_MODEL §26b definition)", () => {
  const records = [rec("KR-2026-001", "sha256:aaa")];

  it("includes intendedKnowledgeVersion and status as §26b defines", () => {
    const base = computePackFingerprint(records, "KB-2026-09-24-001", "APPROVED");
    expect(computePackFingerprint(records, "KB-2026-09-24-002", "APPROVED")).not.toBe(base);
    expect(computePackFingerprint(records, "KB-2026-09-24-001", "NEEDS_REVIEW")).not.toBe(base);
    expect(computePackFingerprint(records, "KB-2026-09-24-001", "APPROVED")).toBe(base);
  });

  it("includes REJECTED records (D-16c)", () => {
    const withRejected = [...records, rec("KR-2026-002", "sha256:rejected")];
    expect(computePackFingerprint(withRejected, null, "NEEDS_REVIEW")).not.toBe(computePackFingerprint(records, null, "NEEDS_REVIEW"));
  });
});
