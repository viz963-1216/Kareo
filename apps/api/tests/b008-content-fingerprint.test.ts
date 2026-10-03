// J-003 repro for B-008-r3 (commit 7b77e9c; hand-back H-3 second round), adapted to call the actual
// production entry point (runApproveKnowledgePack, extracted from approveKnowledgePack.ts) instead of a
// hand-rolled mimic, so the missing-record and review-validation checks are exercised for real.
//
// Expected on 7b77e9c (before this round's fix): A, B and D FAIL; F passes.
//
// 2026-10-03（Jerry 審查修正）：A、B、F 原本在「同一次匯入」裡同時改內容＋把 pack 殼層 status 設
// 為 APPROVED，這個輸入樣態在 B-012-r3 的指紋保護規則修正後已經是明確被拒收的情境（核准必須對應
// 已登錄的內容，不能同一次匯入裡同時改內容又核准）。改為兩個獨立動作：先用 pack 殼層
// status=NEEDS_REVIEW 匯入更正後的內容（只更正個別紀錄，不影響 content_packs 的核准狀態），
// 再對「這筆紀錄」單獨核准（record.status=APPROVED＋完整 review），驗證的核心主張不變——核准
// 綁定的是這次送審當下的實際內容，不是舊的來源雜湊。
import { describe, it, expect } from "vitest";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { runApproveKnowledgePack } from "../src/scripts/approveKnowledgePack.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { RawContentPack } from "../src/types/index.js";

const REGISTRY = parseSourceRegistry(`
| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| \`SRC-LAW-001\` | 長照辦法 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/x | v1 | OK | true |
`);
const SOURCE_HASH = "sha256:" + "a".repeat(64); // official source unchanged in every case
const APPROVED_REVIEW = { reviewedBy: "Jerry", reviewedAt: "2026-09-27T10:00:00+08:00", decision: "APPROVED", notes: null };

type Rec = {
  recordId: string;
  summary: string;
  ruleData: Record<string, unknown>;
  effectiveFrom: string;
  review?: Record<string, unknown> | null;
  // 選填：讓單一紀錄的狀態／review 跟 pack 殼層的 status 脫鉤（核准是逐筆的，不是 pack 層級的）。
  status?: "NEEDS_REVIEW" | "APPROVED";
};
function pack(records: Rec[], status: "NEEDS_REVIEW" | "APPROVED"): RawContentPack {
  const defaultReview = status === "APPROVED"
    ? APPROVED_REVIEW
    : { reviewedBy: null, reviewedAt: null, decision: null, notes: null };
  return {
    packId: "KP-2026-09-27-901", formatVersion: "1.0", createdAt: "2026-09-27T09:00:00+08:00", createdBy: "Jerry",
    sourceRegistryVersion: "SR-2026-09-23-01", status, review: defaultReview,
    intendedKnowledgeVersion: status === "APPROVED" ? "KB-2026-09-27-001" : null,
    records: records.map((r) => {
      const recordStatus = r.status ?? status;
      return {
        recordId: r.recordId, category: "BENEFIT", jurisdiction: "TAIWAN", title: `synthetic ${r.recordId}`,
        source: { sourceId: "SRC-LAW-001", authority: "LAW", url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059",
          fetchedAt: "2026-09-23T10:00:00+08:00", contentHash: SOURCE_HASH },
        publishedAt: "2026-06-19", effectiveFrom: r.effectiveFrom, effectiveTo: null, lastVerifiedAt: "2026-09-23T10:00:00+08:00",
        excerpt: "excerpt", summary: r.summary, ruleData: r.ruleData, status: recordStatus,
        review: r.review === undefined ? (recordStatus === "APPROVED" ? APPROVED_REVIEW : defaultReview) : r.review,
      };
    }),
  } as RawContentPack;
}
const rec = (over: Partial<Rec> = {}): Rec => ({ recordId: "KR-2026-901", summary: "上限 100 元", ruleData: { type: "T", amount: 100 }, effectiveFrom: "2026-07-01", ...over });

describe("B-008 approval binds to the reviewed content, not only the official-source hash", () => {
  it("A. ruleData amount 100 → 200 with the same source hash is not the reviewed content", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    // 更正草稿內容：pack 殼層仍是 NEEDS_REVIEW（不是同一次匯入裡要求核准），只有這筆紀錄本身
    // 單獨標成 APPROVED（送審人已經核准「這次」送審的內容）。
    const changed = pack([rec({ ruleData: { type: "T", amount: 200 }, summary: "上限 200 元", status: "APPROVED" })], "NEEDS_REVIEW");
    const report = await importContentPack(repo, changed, REGISTRY, { mode: "commit" });
    expect(report.written).toBe(true);
    const outcome = await runApproveKnowledgePack(repo, changed);
    expect(outcome.code).toBe(0);
    const approved = repo.records.filter((r) => r.status === "APPROVED").map((r) => (r.ruleData as { amount: number }).amount);
    // Required: either the approved row carries amount 200 (the reviewed text) or nothing is approved.
    expect(approved.filter((a) => a !== 200)).toEqual([]);
  });

  it("B. only effectiveFrom changes: must be recognised as different content", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const changed = pack([rec({ effectiveFrom: "2027-01-01", status: "APPROVED" })], "NEEDS_REVIEW");
    const report = await importContentPack(repo, changed, REGISTRY, { mode: "commit" });
    expect(report.written).toBe(true);
    const outcome = await runApproveKnowledgePack(repo, changed);
    expect(outcome.code).toBe(0);
    const approved = repo.records.filter((r) => r.status === "APPROVED").map((r) => r.effectiveFrom);
    expect(approved.filter((d) => d !== "2027-01-01")).toEqual([]);
  });

  it("C. complete review can approve; missing reviewedBy/reviewedAt or an invalid decision cannot", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });

    const validApproval = pack([rec()], "APPROVED");
    const good = await runApproveKnowledgePack(repo, validApproval);
    expect(good.code).toBe(0);
    expect(good.approved).toHaveLength(1);

    for (const badReview of [
      { reviewedBy: null, reviewedAt: "2026-09-27T10:00:00+08:00", decision: "APPROVED", notes: null },
      { reviewedBy: "Jerry", reviewedAt: null, decision: "APPROVED", notes: null },
      { reviewedBy: "Jerry", reviewedAt: "2026-09-27T10:00:00+08:00", decision: "REJECTED", notes: null },
    ]) {
      const repo2 = new InMemoryKnowledgeRepository();
      await importContentPack(repo2, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
      const badPack = pack([rec({ review: badReview })], "APPROVED");
      const outcome = await runApproveKnowledgePack(repo2, badPack);
      expect(outcome.code).not.toBe(0);
      expect(outcome.invalid.length).toBeGreaterThan(0);
      expect(repo2.records.some((r) => r.status === "APPROVED")).toBe(false);
    }
  });

  it("D. the pack approves two records but the database has one: not a success (missing record reported, none approved)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const two = pack([rec(), rec({ recordId: "KR-2026-902" })], "APPROVED");
    const outcome = await runApproveKnowledgePack(repo, two);
    // Required: the missing record is reported and the whole batch fails (non-zero code), not a silent partial success.
    expect(outcome.code).not.toBe(0);
    expect(outcome.missing).toEqual(["KR-2026-902"]);
    expect(repo.records.some((r) => r.status === "APPROVED")).toBe(false);
  });

  it("G. (B-012-r3) a successful CLI approval writes a CLI_PACK review event alongside the status update", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const approval = pack([rec()], "APPROVED");
    const outcome = await runApproveKnowledgePack(repo, approval);

    expect(outcome.code).toBe(0);
    expect(repo.reviewEvents).toHaveLength(1);
    expect(repo.reviewEvents[0]).toMatchObject({
      knowledgeRecordId: repo.records[0].id,
      decision: "APPROVED",
      reviewedBy: "Jerry",
      source: "CLI_PACK",
    });
  });

  it("F. key order alone does not change the content", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec({ ruleData: { type: "T", amount: 100 } })], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const reordered = pack([rec({ ruleData: { amount: 100, type: "T" }, status: "APPROVED" })], "NEEDS_REVIEW");
    const report = await importContentPack(repo, reordered, REGISTRY, { mode: "commit" });
    const outcome = await runApproveKnowledgePack(repo, reordered);
    expect(report.recordsRejected).toEqual([]);
    expect(outcome.code).toBe(0);
    expect(repo.records.filter((r) => r.status === "APPROVED")).toHaveLength(1);
  });
});
