// 受保護的內部查件與狀態更新 CLI，依 docs/LEAD_OPERATIONS.md §4。於操作者本機以安全環境變數執行，
// 不提供公開管理 endpoint（ARCHITECTURE §20.8）。
//
// 操作者身分與密鑰一律讀環境變數，不放在 CLI 參數（避免留在 shell history）：
//   KAREO_OPERATOR_ID=<operatorId> KAREO_OPERATOR_KEY=<key> npm run lead -- <command> [args]
//
// 用法：
//   npm run lead -- list   [--status NEW] [--since 2026-10-01]
//   npm run lead -- show   <leadId>
//   npm run lead -- reveal-contact <leadId>
//   npm run lead -- update <leadId> --to CONTACTED [--reason CODE] [--note "..."]
import { SupabaseLeadRepository } from "../repositories/supabaseLeadRepository.js";
import { requireOperator } from "../services/internalOperatorService.js";
import { listLeads, revealContact, showLead, updateLeadStatus } from "../services/leadOperationsService.js";
import type { LeadStatus } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

const LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ACCEPTED", "CLOSED", "CANCELLED"];

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) flags[arg.slice(2)] = "true";
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function isLeadStatus(value: string | undefined): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as string[]).includes(value);
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    console.error("用法：list|show|reveal-contact|update ...（見本檔檔頭註解）");
    return 2;
  }

  const operatorId = process.env.KAREO_OPERATOR_ID;
  const operatorKey = process.env.KAREO_OPERATOR_KEY;
  const repo = new SupabaseLeadRepository();

  try {
    if (command === "list") {
      const { flags } = parseFlags(rest);
      if (flags.status && !isLeadStatus(flags.status)) {
        console.error(`--status 不合法，必須是：${LEAD_STATUSES.join(", ")}`);
        return 2;
      }
      await requireOperator(repo, operatorId, operatorKey, "LEAD_OPERATOR");
      const leads = await listLeads(repo, {
        status: isLeadStatus(flags.status) ? flags.status : null,
        since: flags.since ?? null,
      });
      console.log(JSON.stringify(leads, null, 2));
      return 0;
    }

    if (command === "show") {
      const { positional } = parseFlags(rest);
      const leadId = positional[0];
      if (!leadId) {
        console.error("用法：show <leadId>");
        return 2;
      }
      await requireOperator(repo, operatorId, operatorKey, "LEAD_OPERATOR");
      const lead = await showLead(repo, leadId);
      console.log(JSON.stringify(lead, null, 2));
      return 0;
    }

    if (command === "reveal-contact") {
      const { positional } = parseFlags(rest);
      const leadId = positional[0];
      if (!leadId) {
        console.error("用法：reveal-contact <leadId>");
        return 2;
      }
      const operator = await requireOperator(repo, operatorId, operatorKey, "LEAD_OPERATOR");
      const contact = await revealContact(repo, leadId, operator.id);
      // 畫面輸出，不進入任何結構化 log（LEAD_OPERATIONS §4）。
      console.log(JSON.stringify(contact, null, 2));
      return 0;
    }

    if (command === "update") {
      const { positional, flags } = parseFlags(rest);
      const leadId = positional[0];
      if (!leadId || !flags.to) {
        console.error("用法：update <leadId> --to <STATUS> [--reason CODE] [--note \"...\"]");
        return 2;
      }
      if (!isLeadStatus(flags.to)) {
        console.error(`--to 不合法，必須是：${LEAD_STATUSES.join(", ")}`);
        return 2;
      }
      const operator = await requireOperator(repo, operatorId, operatorKey, "LEAD_OPERATOR");
      const event = await updateLeadStatus(repo, {
        leadId,
        toStatus: flags.to,
        reasonCode: flags.reason ?? null,
        note: flags.note ?? null,
        operatorId: operator.id,
      });
      console.log(JSON.stringify(event, null, 2));
      return 0;
    }

    console.error(`未知指令：${command}`);
    return 2;
  } catch (err) {
    if (err instanceof AppError) {
      console.error(`${err.code}: ${err.message}`);
      return 1;
    }
    console.error("指令執行失敗：", err instanceof Error ? err.message : err);
    return 1;
  }
}

main()
  .then((code) => (process.exitCode = code))
  .catch((err) => {
    console.error("指令執行失敗：", err);
    process.exitCode = 1;
  });
