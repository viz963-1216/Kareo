import { describe, it, expect } from "vitest";
import { computePackFingerprint, computeRecordsFingerprint } from "../src/services/packFingerprint.js";

// DATA_MODEL §26b：packFingerprint = 依 recordId 排序的 (recordId, contentFingerprint) + intendedKnowledgeVersion
// + status；recordsFingerprint 只含逐筆內容，用來判斷同一 packId 內容是否改變。兩者都排除 REJECTED 紀錄。
const rec = (recordId: string, contentFingerprint: string, packStatus = "APPROVED") => ({ recordId, contentFingerprint, packStatus });

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

  it("does not depend on pack status / intendedKnowledgeVersion (promotion keeps content identity)", () => {
    const needsReview = [rec("KR-2026-001", "sha256:aaa", "NEEDS_REVIEW")];
    const approved = [rec("KR-2026-001", "sha256:aaa", "APPROVED")];
    expect(computeRecordsFingerprint(needsReview)).toBe(computeRecordsFingerprint(approved));
  });

  it("excludes REJECTED records, so import and backfill agree on packs that contain one", () => {
    const withRejected = [rec("KR-2026-001", "sha256:aaa"), rec("KR-2026-002", "sha256:rejected", "REJECTED")];
    const withoutRejected = [rec("KR-2026-001", "sha256:aaa")];
    expect(computeRecordsFingerprint(withRejected)).toBe(computeRecordsFingerprint(withoutRejected));
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

  it("excludes REJECTED records", () => {
    const withRejected = [...records, rec("KR-2026-002", "sha256:rejected", "REJECTED")];
    expect(computePackFingerprint(withRejected, null, "NEEDS_REVIEW")).toBe(computePackFingerprint(records, null, "NEEDS_REVIEW"));
  });
});
