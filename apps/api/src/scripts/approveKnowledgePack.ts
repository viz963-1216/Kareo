// 受保護的內部指令，依 contracts/knowledge/README.md §4：
// 「B-008 approve：只接受內容包中 decision = APPROVED 的紀錄」。
// 讀同一份內容包檔案，把 status=APPROVED 的紀錄（依 packId+recordId 對應回資料庫 id）核准；
// 核准前逐筆核對資料庫目前內容指紋是否等於這份 pack 宣告當下算出的內容指紋（不是來源雜湊），
// 避免核准與匯入之間出現競態（核准當下內容已經跟審核時不同卻只靠 ID／status 核准）。
//
// Jerry 委託修正第二輪（2026-09-27）：
// 1. review 欄位（reviewedBy／reviewedAt／decision）在這裡（核准當下）也要重新驗證，不能只信任
//    pack 檔案裡的 status 欄位——pack 檔案可能在匯入之後被人手動改過，approveKnowledgePack 是
//    獨立指令，不能假設它一定緊接在對同一份檔案的 importKnowledgePack 之後執行。
// 2. Pack 要求核准的筆數與資料庫實際找到、且通過 review 驗證的候選筆數不一致 → 視為缺筆，明確
//    以非零結束碼失敗，不得「部分對上仍 exit 0」。
// 3. 核准結果只要有任何一筆沒有成功核准（不論是內容指紋不符、缺筆、或狀態不對），整體結束碼一律
//    非零——不以「總核准數 > 0」代表成功。
//
// 用法：node dist/scripts/approveKnowledgePack.js <content-pack.json>
import { readFileSync } from "node:fs";
import { computeContentFingerprint } from "../services/contentFingerprint.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import type { KnowledgeRepository } from "../repositories/types.js";
import type { RawContentPack, RawContentPackRecord } from "../types/index.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

interface ApprovableRecord {
  recordId: string;
  expectedContentFingerprint: string;
  reviewedBy: string;
}

// 重新驗證 review 欄位是否完整（不信任 pack 檔案的 status，見上方檔頭說明）；並從記錄的實際內容
// （不是 source.contentHash）算出這次核准要核對的內容指紋，跟匯入時算的方式必須一致。
function validateApprovableRecord(raw: RawContentPackRecord): { ok: true; value: ApprovableRecord } | { ok: false; reason: string } {
  const recordId = raw.recordId;
  if (!isNonEmptyString(recordId)) return { ok: false, reason: "缺少 recordId" };

  const review = raw.review as Record<string, unknown> | undefined;
  if (typeof review !== "object" || review === null) return { ok: false, reason: `${recordId}: 缺少 review` };
  if (review.decision !== "APPROVED") return { ok: false, reason: `${recordId}: review.decision 不是 APPROVED` };
  if (!isNonEmptyString(review.reviewedBy)) return { ok: false, reason: `${recordId}: review.reviewedBy 不得為空` };
  if (!isNonEmptyString(review.reviewedAt) || !ISO_DATETIME.test(review.reviewedAt))
    return { ok: false, reason: `${recordId}: review.reviewedAt 格式不合法` };

  const source = raw.source as Record<string, unknown> | undefined;
  if (typeof source !== "object" || source === null) return { ok: false, reason: `${recordId}: 缺少 source` };

  // 內容指紋涵蓋的欄位必須跟 knowledgeImportService.ts 的 validateRecord 完全一致，
  // 否則同一份內容在匯入與核准兩處會算出不同指紋，永遠對不上。
  try {
    const fingerprint = computeContentFingerprint({
      sourceId: source.sourceId as string,
      sourceUrl: source.url as string,
      title: raw.title as string,
      category: raw.category as string,
      jurisdiction: raw.jurisdiction as string,
      publishedAt: (raw.publishedAt as string | null) ?? null,
      effectiveFrom: raw.effectiveFrom as string,
      effectiveTo: (raw.effectiveTo as string | null) ?? null,
      rawText: raw.excerpt as string,
      summary: raw.summary as string,
      ruleData: raw.ruleData as Record<string, unknown>,
    });
    return { ok: true, value: { recordId, expectedContentFingerprint: fingerprint, reviewedBy: review.reviewedBy as string } };
  } catch {
    return { ok: false, reason: `${recordId}: 無法從內容算出指紋（欄位缺漏或格式不合法）` };
  }
}

export interface ApproveKnowledgePackOutcome {
  code: number;
  approved: string[];
  notApproved: string[];
  contentMismatched: Array<{ packRecordId: string; dbId: string }>;
  invalid: string[];
  missing: string[];
}

// 抽出核心邏輯供測試直接呼叫（不需要真的讀檔／建立 Supabase client），main() 只負責讀檔、
// 組 repo、印訊息、轉成 process.exitCode。回傳的 code 就是最終的行程結束碼。
export async function runApproveKnowledgePack(repo: KnowledgeRepository, pack: RawContentPack): Promise<ApproveKnowledgePackOutcome> {
  const packId = pack.packId as string;
  const records = (pack.records as RawContentPackRecord[]) ?? [];
  const requestedApprovals = records.filter((r) => r.status === "APPROVED");

  if (requestedApprovals.length === 0) {
    return { code: 0, approved: [], notApproved: [], contentMismatched: [], invalid: [], missing: [] };
  }

  const approvable = new Map<string, ApprovableRecord>();
  const invalid: string[] = [];
  for (const raw of requestedApprovals) {
    const result = validateApprovableRecord(raw);
    if (result.ok) approvable.set(result.value.recordId, result.value);
    else invalid.push(result.reason);
  }
  if (invalid.length > 0) {
    return { code: 1, approved: [], notApproved: [], contentMismatched: [], invalid, missing: [] };
  }

  const dbRecords = await repo.findRecordsByPackId(packId);
  const dbByPackRecordId = new Map(dbRecords.map((r) => [r.packRecordId, r]));

  const missing = [...approvable.keys()].filter((recordId) => !dbByPackRecordId.has(recordId));
  if (missing.length > 0) {
    return { code: 1, approved: [], notApproved: [], contentMismatched: [], invalid: [], missing };
  }

  const candidates = [...approvable.values()].map((a) => ({
    dbId: dbByPackRecordId.get(a.recordId)!.id,
    packRecordId: a.recordId,
    expectedContentFingerprint: a.expectedContentFingerprint,
    reviewedBy: a.reviewedBy,
  }));

  // TASK-B-012-r3（Jerry 指示 2）：CLI 核准跟管理頁核准寫入同一份只能新增的審核紀錄
  // （knowledge_record_review_events，source=CLI_PACK），且跟狀態更新在同一交易內完成
  // （見 repo.approveOrRejectRecordWithReview／approve_or_reject_knowledge_record）。
  // 核准前已知的「不是待審核」「內容指紋不符」原因在呼叫前先分類，維持既有的
  // approved／notApproved／contentMismatched 回報語意不變。
  const approved: string[] = [];
  const notApproved: string[] = [];
  const contentMismatched: Array<{ packRecordId: string; dbId: string }> = [];
  for (const c of candidates) {
    const current = dbByPackRecordId.get(c.packRecordId)!;
    if (current.status !== "NEEDS_REVIEW") {
      notApproved.push(c.dbId);
      continue;
    }
    if (current.contentFingerprint !== c.expectedContentFingerprint) {
      contentMismatched.push({ packRecordId: c.packRecordId, dbId: c.dbId });
      continue;
    }
    const outcome = await repo.approveOrRejectRecordWithReview({
      recordId: c.dbId,
      decision: "APPROVED",
      reason: null,
      expectedContentFingerprint: c.expectedContentFingerprint,
      reviewedBy: c.reviewedBy,
      source: "CLI_PACK",
    });
    if (outcome.updated) approved.push(c.dbId);
    else notApproved.push(c.dbId);
  }

  // 部分對上仍不算成功：要求核准的每一筆都必須真的被核准，缺一筆就是失敗（非零結束碼）。
  const code = approved.length === candidates.length ? 0 : 1;
  return { code, approved, notApproved, contentMismatched, invalid: [], missing: [] };
}

async function main(): Promise<number> {
  const packPath = process.argv[2];
  if (!packPath) {
    console.error("用法：<content-pack.json>");
    return 2;
  }

  const pack = JSON.parse(readFileSync(packPath, "utf-8")) as RawContentPack;
  const repo = new SupabaseKnowledgeRepository();
  const outcome = await runApproveKnowledgePack(repo, pack);

  if (outcome.invalid.length > 0) {
    console.error(`內容包中有 ${outcome.invalid.length} 筆要求核准的紀錄未通過 review／內容驗證，整批不核准：`);
    console.error(outcome.invalid.join("\n"));
    return outcome.code;
  }
  if (outcome.missing.length > 0) {
    console.error(
      `Pack 要求核准的紀錄中，資料庫缺少 ${outcome.missing.length} 筆對應的紀錄（尚未匯入，或 packId 不符）：`
    );
    console.error(outcome.missing.join(", "));
    return outcome.code;
  }

  console.log(`Approved: ${outcome.approved.length}`);
  console.log(`Not approved (already approved / rejected / conflict / not found): ${outcome.notApproved.length}`);
  if (outcome.notApproved.length > 0) {
    console.log(JSON.stringify(outcome.notApproved, null, 2));
  }
  if (outcome.contentMismatched.length > 0) {
    console.error(
      `Content mismatch (database content differs from what this pack declares — not approved, re-check before retrying): ${outcome.contentMismatched.length}`
    );
    console.error(JSON.stringify(outcome.contentMismatched, null, 2));
  }
  if (outcome.code !== 0) {
    console.error(`要求核准的紀錄未能全部核准，視為失敗。`);
  }
  return outcome.code;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Approve failed:", err);
    process.exitCode = 1;
  });
