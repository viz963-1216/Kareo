import { describe, it, expect } from "vitest";
import { computePackFingerprint } from "../src/services/packFingerprint.js";

describe("computePackFingerprint (B-012-r3: content_packs 同一性判斷)", () => {
  it("same records, version and status produce the same fingerprint", () => {
    const records = [
      { recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" },
      { recordId: "KR-2026-002", contentFingerprint: "sha256:bbb" },
    ];
    const a = computePackFingerprint(records, "KB-2026-10-01-001", "APPROVED");
    const b = computePackFingerprint(records, "KB-2026-10-01-001", "APPROVED");
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("record order does not change the fingerprint (sorted by recordId internally)", () => {
    const forward = [
      { recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" },
      { recordId: "KR-2026-002", contentFingerprint: "sha256:bbb" },
    ];
    const reversed = [...forward].reverse();
    expect(computePackFingerprint(forward, "KB-2026-10-01-001", "APPROVED")).toBe(
      computePackFingerprint(reversed, "KB-2026-10-01-001", "APPROVED")
    );
  });

  it("a different record content fingerprint changes the pack fingerprint", () => {
    const base = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    const changed = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:zzz" }];
    expect(computePackFingerprint(base, "KB-2026-10-01-001", "APPROVED")).not.toBe(
      computePackFingerprint(changed, "KB-2026-10-01-001", "APPROVED")
    );
  });

  it("a different intendedKnowledgeVersion changes the pack fingerprint even with identical records", () => {
    const records = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    expect(computePackFingerprint(records, "KB-2026-10-01-001", "APPROVED")).not.toBe(
      computePackFingerprint(records, "KB-2026-10-02-001", "APPROVED")
    );
  });

  it("a different status changes the pack fingerprint even with identical records and version", () => {
    const records = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    expect(computePackFingerprint(records, "KB-2026-10-01-001", "NEEDS_REVIEW")).not.toBe(
      computePackFingerprint(records, "KB-2026-10-01-001", "APPROVED")
    );
  });

  it("adding or removing a record changes the pack fingerprint", () => {
    const one = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    const two = [...one, { recordId: "KR-2026-002", contentFingerprint: "sha256:bbb" }];
    expect(computePackFingerprint(one, "KB-2026-10-01-001", "APPROVED")).not.toBe(
      computePackFingerprint(two, "KB-2026-10-01-001", "APPROVED")
    );
  });
});
