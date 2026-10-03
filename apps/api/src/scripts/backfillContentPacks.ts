// 受保護的內部指令（DATA_MODEL §26b、§26c）：讀 contracts/knowledge/packs/*.json（Jerry 所有，只讀），
// 針對 B-012 上線前就已經匯入的內容包：
//   1. 補登 content_packs（含內容包 review 與匯入證據），驗證規則與匯入共用 validatePackShell；
//   2. 補登既有已核准紀錄的逐筆審核證據（knowledge_record_review_events，source=CLI_PACK）。
//
// 安全性：
// - 這份檔案宣告的每一筆非 REJECTED 紀錄，依內容算出的指紋都必須與資料庫目前內容一致；REJECTED 紀錄
//   從未建立資料庫紀錄，但仍以檔案內容計入指紋（與匯入相同的紀錄集合與算法，DATA_MODEL §26b），若資料庫
//   中意外存在同 recordId 的紀錄也必須一致。任何一筆缺漏或不符，整個內容包都跳過並列出差異，非零退出
//   （不自動更正內容，不登錄跟資料庫現況不符的資料）。
// - 執行者（D-16c）：必須以 --operator-id 加上既有個人密鑰（環境變數 KAREO_OPERATOR_KEY）通過
//   KNOWLEDGE_PUBLISHER 角色驗證，失敗時在任何讀檔與寫入前拒絕。content_packs.importedBy 記錄本次補登
//   的實際操作者；importedAt／importedBy 已存在時保留首次登錄值，不冒充歷史匯入人／時間。
// - 審核證據的審核人／時間取自已核准 JSON 的逐筆 review，不使用執行當下時間、不虛構新審閱；只補
//   資料庫中確實已核准（APPROVED／PUBLISHED／SUPERSEDED）的紀錄；同一紀錄同一內容指紋不重複寫入。
// - 不變更任何紀錄的狀態或內容（已發布紀錄維持原狀）。
//
// 用法（需先 npm run build；需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   KAREO_OPERATOR_KEY=<key> node dist/scripts/backfillContentPacks.js --operator-id <InternalOperator ID> [contracts/knowledge/packs 目錄路徑]
// Exit code：0 = 全部登錄或沒有可登錄的內容包；1 = 有內容包被跳過（需要人工確認）、操作者驗證失敗或執行錯誤；
// 2 = 參數錯誤。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeContentFingerprint } from "../services/contentFingerprint.js";
import { computePackFingerprint, computeRecordsFingerprint, type PackFingerprintRecord } from "../services/packFingerprint.js";
import { validatePackShell } from "../services/knowledgeImportService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { SupabaseAdminKnowledgeRepository } from "../repositories/supabaseAdminKnowledgeRepository.js";
import { requireOperator } from "../services/internalOperatorService.js";
import { AppError } from "../errors/AppError.js";
import type { KnowledgeRepository, LeadRepository } from "../repositories/types.js";
import type { KnowledgeRecord, RawContentPack, RawContentPackRecord } from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const APPROVED_IN_DATABASE: ReadonlyArray<KnowledgeRecord["status"]> = ["APPROVED", "PUBLISHED", "SUPERSEDED"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export interface BackfillOutcome {
  registered: string[];
  skipped: Array<{ packId: string; reasons: string[] }>;
  reviewEventsInserted: number;
  reviewEventsAlreadyPresent: number;
}

interface PendingReviewEvent {
  recordId: string;
  reviewedBy: string;
  reviewedAt: string;
  reason: string | null;
  contentFingerprint: string;
}

// importedBy：已通過 KNOWLEDGE_PUBLISHER 驗證的實際操作者 ID（由 runBackfillCli 驗證後傳入）。
export async function runBackfillContentPacks(
  repo: KnowledgeRepository,
  packs: RawContentPack[],
  options: { importedBy: string }
): Promise<BackfillOutcome> {
  if (!isNonEmptyString(options.importedBy)) {
    throw new AppError("FORBIDDEN", "回填需要已驗證的操作者身分。");
  }
  const outcome: BackfillOutcome = { registered: [], skipped: [], reviewEventsInserted: 0, reviewEventsAlreadyPresent: 0 };

  for (const raw of packs) {
    const packId = isNonEmptyString(raw.packId) ? raw.packId : "(invalid packId)";
    const reasons = [...validatePackShell(raw).reasons];
    if (reasons.length > 0) {
      outcome.skipped.push({ packId, reasons });
      continue;
    }

    const rawRecords = raw.records as RawContentPackRecord[];
    const dbByPackRecordId = new Map((await repo.findRecordsByPackId(packId)).map((r) => [r.packRecordId, r]));
    const fingerprintInputs: PackFingerprintRecord[] = [];
    const pendingEvents: PendingReviewEvent[] = [];

    for (const r of rawRecords) {
      const recordId = r.recordId as string;
      const isRejectedInPack = r.status === "REJECTED";
      const dbRecord = dbByPackRecordId.get(recordId);
      if (!dbRecord && !isRejectedInPack) {
        reasons.push(`${recordId}: 資料庫中找不到對應紀錄`);
        continue;
      }
      const source = r.source as Record<string, unknown>;
      let computed: string;
      try {
        computed = computeContentFingerprint({
          sourceId: source.sourceId as string,
          sourceUrl: source.url as string,
          title: r.title as string,
          category: r.category as string,
          jurisdiction: r.jurisdiction as string,
          publishedAt: (r.publishedAt as string | null) ?? null,
          effectiveFrom: r.effectiveFrom as string,
          effectiveTo: (r.effectiveTo as string | null) ?? null,
          rawText: r.excerpt as string,
          summary: r.summary as string,
          ruleData: r.ruleData as Record<string, unknown>,
        });
      } catch {
        reasons.push(`${recordId}: 無法從內容算出指紋（欄位缺漏或格式不合法）`);
        continue;
      }
      if (dbRecord && computed !== dbRecord.contentFingerprint) {
        reasons.push(
          `${recordId}: 內容指紋與資料庫現況不符（檔案 ${computed}，資料庫紀錄 ${dbRecord.id} 為 ${dbRecord.contentFingerprint}）；` +
            `已提交內容不可改寫，需人工以新 packId／recordId 處理`
        );
        continue;
      }
      // REJECTED 紀錄同樣計入指紋（以檔案內容計算），與匯入使用相同紀錄集合。
      fingerprintInputs.push({ recordId, contentFingerprint: computed });

      if (!dbRecord || r.status !== "APPROVED" || !APPROVED_IN_DATABASE.includes(dbRecord.status)) continue;
      const review = r.review as Record<string, unknown> | undefined;
      if (!review || !isNonEmptyString(review.reviewedBy) || !isNonEmptyString(review.reviewedAt) || !ISO_DATETIME.test(review.reviewedAt)) {
        reasons.push(`${recordId}: 紀錄為 APPROVED 但逐筆 review 不完整，無法補登審核證據`);
        continue;
      }
      pendingEvents.push({
        recordId: dbRecord.id,
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt,
        reason: isNonEmptyString(review.notes) ? review.notes : null,
        contentFingerprint: computed,
      });
    }

    const fileRecordIds = new Set(rawRecords.map((r) => r.recordId as string));
    for (const [packRecordId, dbRecord] of dbByPackRecordId) {
      if (!fileRecordIds.has(packRecordId)) reasons.push(`${packRecordId}: 資料庫紀錄 ${dbRecord.id} 不在內容包檔案中（檔案與資料庫已經不一致）`);
    }
    // 全部是 REJECTED 時資料庫沒有任何紀錄可證明此包曾匯入，不憑空登錄。
    if (reasons.length === 0 && dbByPackRecordId.size === 0) reasons.push("資料庫中沒有此內容包的任何紀錄（可能全部是 REJECTED），無法確認曾匯入");
    if (reasons.length > 0) {
      outcome.skipped.push({ packId, reasons });
      continue;
    }

    const intendedKnowledgeVersion = (raw.intendedKnowledgeVersion as string | null) ?? null;
    const status = raw.status as string;
    const review = raw.review as Record<string, unknown>;
    try {
      await repo.upsertContentPack({
        packId,
        formatVersion: raw.formatVersion as string,
        intendedKnowledgeVersion,
        sourceRegistryVersion: isNonEmptyString(raw.sourceRegistryVersion) ? raw.sourceRegistryVersion : null,
        status,
        reviewedBy: isNonEmptyString(review.reviewedBy) ? review.reviewedBy : null,
        reviewedAt: isNonEmptyString(review.reviewedAt) ? review.reviewedAt : null,
        reviewDecision: isNonEmptyString(review.decision) ? review.decision : null,
        packFingerprint: computePackFingerprint(fingerprintInputs, intendedKnowledgeVersion, status),
        recordsFingerprint: computeRecordsFingerprint(fingerprintInputs),
        importedBy: options.importedBy,
      });
    } catch (err) {
      if (err instanceof AppError && err.message.includes("PACK_CONTENT_CHANGED")) {
        outcome.skipped.push({ packId, reasons: [err.message] });
        continue;
      }
      throw err;
    }
    outcome.registered.push(packId);

    for (const event of pendingEvents) {
      const { inserted } = await repo.backfillRecordReviewEvent(event);
      if (inserted) outcome.reviewEventsInserted += 1;
      else outcome.reviewEventsAlreadyPresent += 1;
    }
  }

  return outcome;
}

export interface BackfillCliDeps {
  knowledgeRepo: KnowledgeRepository;
  operatorRepo: Pick<LeadRepository, "findOperatorById">;
  loadPacks: (packsDir: string) => RawContentPack[];
  log: (message: string) => void;
  error: (message: string) => void;
}

// 只接受 --operator-id <id> 與一個選填的目錄參數；其他旗標（例如 --operator-key）一律視為參數錯誤。
function parseBackfillArgs(argv: string[]): { operatorId: string | null; packsDir: string } | null {
  let operatorId: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--operator-id" || arg.startsWith("--operator-id=")) {
      const value = arg === "--operator-id" ? argv[++i] : arg.slice("--operator-id=".length);
      if (value === undefined || value.startsWith("--") || value.trim().length === 0) return null;
      operatorId = value;
    } else if (arg.startsWith("--")) return null;
    else positional.push(arg);
  }
  if (positional.length > 1) return null;
  return { operatorId, packsDir: positional[0] ?? path.resolve(__dirname, "../../../../contracts/knowledge/packs") };
}

// 正式入口（直接執行時由下方組裝 Supabase repository）；測試直接呼叫本函式驗證負向情境。
export async function runBackfillCli(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: BackfillCliDeps
): Promise<number> {
  const args = parseBackfillArgs(argv);
  if (!args) {
    deps.error("用法：--operator-id <id> [contracts/knowledge/packs 目錄路徑]（密鑰以 KAREO_OPERATOR_KEY 環境變數提供）");
    return 2;
  }

  let operatorId: string;
  try {
    operatorId = (await requireOperator(deps.operatorRepo, args.operatorId, env.KAREO_OPERATOR_KEY, "KNOWLEDGE_PUBLISHER")).id;
  } catch (err) {
    if (err instanceof AppError && (err.code === "SESSION_INVALID" || err.code === "FORBIDDEN")) {
      deps.error(`操作者驗證失敗（${err.code}）：${err.message} 未寫入任何資料。`);
      return 1;
    }
    throw err;
  }

  const outcome = await runBackfillContentPacks(deps.knowledgeRepo, deps.loadPacks(args.packsDir), { importedBy: operatorId });

  deps.log(`Operator: ${operatorId}`);
  deps.log(`Registered: ${outcome.registered.length}`);
  if (outcome.registered.length > 0) deps.log(outcome.registered.join(", "));
  deps.log(`Review events inserted: ${outcome.reviewEventsInserted}, already present: ${outcome.reviewEventsAlreadyPresent}`);
  deps.log(`Skipped (inconsistent with database, need manual review): ${outcome.skipped.length}`);
  if (outcome.skipped.length > 0) deps.log(JSON.stringify(outcome.skipped, null, 2));

  return outcome.skipped.length > 0 ? 1 : 0;
}

function loadPacksFromDir(packsDir: string): RawContentPack[] {
  const files = readdirSync(packsDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => JSON.parse(readFileSync(path.join(packsDir, f), "utf-8")) as RawContentPack);
}

// 只有直接執行本檔時才跑 CLI；被測試或其他模組 import 時不得自動連線 Supabase。
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runBackfillCli(process.argv.slice(2), process.env, {
    knowledgeRepo: new SupabaseKnowledgeRepository(),
    operatorRepo: new SupabaseAdminKnowledgeRepository(),
    loadPacks: loadPacksFromDir,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exitCode = 1;
    });
}
