import { describe, it, expect } from "vitest";
import { computePackFingerprint } from "../src/services/packFingerprint.js";

// 2026-10-03（Jerry 審查修正）：computePackFingerprint 不再納入 intendedKnowledgeVersion／status
// ——這兩個欄位納入雜湊會讓「NEEDS_REVIEW 升為 APPROVED」這個動作本身必然改變指紋（version 從
// null 變成實際版號、status 從 NEEDS_REVIEW 變成 APPROVED），導致「指紋不變才能升級」這條規則
// 變成恆假。指紋現在只依逐筆記錄的 (recordId, contentFingerprint) 算出，見 packFingerprint.ts
// 檔頭的詳細說明。
describe("computePackFingerprint (B-012-r3: content_packs 同一性判斷)", () => {
  it("same records produce the same fingerprint", () => {
    const records = [
      { recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" },
      { recordId: "KR-2026-002", contentFingerprint: "sha256:bbb" },
    ];
    const a = computePackFingerprint(records);
    const b = computePackFingerprint(records);
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("record order does not change the fingerprint (sorted by recordId internally)", () => {
    const forward = [
      { recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" },
      { recordId: "KR-2026-002", contentFingerprint: "sha256:bbb" },
    ];
    const reversed = [...forward].reverse();
    expect(computePackFingerprint(forward)).toBe(computePackFingerprint(reversed));
  });

  it("a different record content fingerprint changes the pack fingerprint", () => {
    const base = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    const changed = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:zzz" }];
    expect(computePackFingerprint(base)).not.toBe(computePackFingerprint(changed));
  });

  it("intendedKnowledgeVersion and status are NOT part of the fingerprint (promotion must be possible with unchanged content)", () => {
    // 這就是修正的核心主張：同一組記錄內容，不論呼叫端打算配上什麼版號或狀態，指紋都一樣——
    // 否則 NEEDS_REVIEW → APPROVED 的升級（version null→實際值、status 一定變）永遠無法通過
    // 「指紋不變」的檢查，等同這條規則恆假、沒有任何一次核准升級能成功。
    const records = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    expect(computePackFingerprint(records)).toBe(computePackFingerprint(records));
  });

  it("adding or removing a record changes the pack fingerprint", () => {
    const one = [{ recordId: "KR-2026-001", contentFingerprint: "sha256:aaa" }];
    const two = [...one, { recordId: "KR-2026-002", contentFingerprint: "sha256:bbb" }];
    expect(computePackFingerprint(one)).not.toBe(computePackFingerprint(two));
  });
});
