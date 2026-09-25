import { describe, it, expect } from "vitest";
import {
  FakeConsentVersionChecker,
  RealConsentVersionChecker,
  isActiveComboAmong,
} from "../src/services/consentVersionService.js";

const ENTRIES = [
  {
    disclaimerVersion: "1.0",
    privacyVersion: "1.0",
    termsVersion: "1.0",
    status: "ACTIVE",
  },
  {
    disclaimerVersion: "0.9",
    privacyVersion: "0.9",
    termsVersion: "0.9",
    status: "REJECTED",
  },
  {
    disclaimerVersion: "2.0-draft",
    privacyVersion: "2.0-draft",
    termsVersion: "2.0-draft",
    status: "ACTIVE", // 故意錯標成 ACTIVE，驗證 -draft 仍然被擋下
  },
];

describe("isActiveComboAmong", () => {
  it("accepts an ACTIVE combination", () => {
    expect(isActiveComboAmong(ENTRIES, "1.0", "1.0", "1.0")).toBe(true);
  });

  it("rejects a combination that is not ACTIVE", () => {
    expect(isActiveComboAmong(ENTRIES, "0.9", "0.9", "0.9")).toBe(false);
  });

  it("rejects a combination that does not exist at all", () => {
    expect(isActiveComboAmong(ENTRIES, "9.9", "9.9", "9.9")).toBe(false);
  });

  it("rejects any -draft version even if status says ACTIVE (defense in depth)", () => {
    expect(isActiveComboAmong(ENTRIES, "2.0-draft", "2.0-draft", "2.0-draft")).toBe(false);
  });

  it("rejects a partial match (only some fields matching an ACTIVE entry)", () => {
    expect(isActiveComboAmong(ENTRIES, "1.0", "1.0", "0.9")).toBe(false);
  });
});

describe("FakeConsentVersionChecker", () => {
  it("only accepts the combinations explicitly given to it", () => {
    const checker = new FakeConsentVersionChecker([
      { disclaimerVersion: "a", privacyVersion: "b", termsVersion: "c" },
    ]);
    expect(checker.isActive("a", "b", "c")).toBe(true);
    expect(checker.isActive("x", "y", "z")).toBe(false);
    expect(checker.hasAnyActive()).toBe(true);
  });

  it("defaults to no active combinations", () => {
    const checker = new FakeConsentVersionChecker();
    expect(checker.hasAnyActive()).toBe(false);
  });
});

describe("RealConsentVersionChecker (reads the real contracts/legal/consent-versions.json)", () => {
  // 已知現況（見 PR Known Issues）：目前真實檔案只有一筆 DRAFT，沒有任何 ACTIVE 組合。
  // 這個測試記錄「目前現況」，一旦 Jerry 核准正式版本，這個測試會失敗，提醒需要更新，
  // 而不是靜默地假裝一切正常。
  it("currently has no ACTIVE combination at all (legal review pending)", () => {
    const checker = new RealConsentVersionChecker();
    expect(checker.hasAnyActive()).toBe(false);
  });

  it("rejects the current DRAFT entry even by exact version match (because it is DRAFT, and because it ends in -draft)", () => {
    const checker = new RealConsentVersionChecker();
    expect(checker.isActive("2026-10-01-r1-draft", "2026-10-01-r1-draft", "2026-10-01-r1-draft")).toBe(false);
  });
});
