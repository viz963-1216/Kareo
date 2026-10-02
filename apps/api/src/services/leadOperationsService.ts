// TASK-B-006：受保護的內部查件與狀態更新邏輯，依 docs/LEAD_OPERATIONS.md §3-4。
// 只供 src/scripts/lead.ts（CLI）呼叫，不對外提供 HTTP endpoint（DATA_MODEL §36、ARCHITECTURE §20.8）。
import type { LeadRepository } from "../repositories/types.js";
import type { Lead, LeadStatus, LeadStatusEvent } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export type LeadListItem = Omit<Lead, "contactPhone">;

// list／show 不輸出電話，只有 reveal-contact 顯示（LEAD_OPERATIONS §4）。
function withoutPhone(lead: Lead): LeadListItem {
  const { contactPhone: _contactPhone, ...rest } = lead;
  return rest;
}

export async function listLeads(
  repo: LeadRepository,
  filter: { status: LeadStatus | null; since: string | null }
): Promise<LeadListItem[]> {
  const leads = await repo.listLeads(filter);
  return leads.map(withoutPhone);
}

export async function showLead(repo: LeadRepository, leadId: string): Promise<LeadListItem> {
  const lead = await repo.findById(leadId);
  if (!lead) throw new AppError("NOT_FOUND", "找不到指定的 Lead。");
  return withoutPhone(lead);
}

// J-003-r8（Jerry 委託審查 #47，問題 2）：reveal-contact 只能由「被指派案件」的操作者執行
// （LEAD_OPERATIONS §2：`lead:reveal-contact`（被指派案件））。未指派的案件視為「第一個
// reveal-contact 的操作者接手這個案件」，之後只有該操作者能再次查看；已指派給別人的案件一律拒絕，
// 不得因為 MVP 目前只有一位接件人就略過這個檢查。
export async function revealContact(
  repo: LeadRepository,
  leadId: string,
  operatorId: string
): Promise<{ name: string | null; phone: string | null }> {
  const claimed = await repo.claimLeadForReveal(leadId, operatorId);
  if (!claimed) throw new AppError("NOT_FOUND", "找不到指定的 Lead。");
  if (claimed.assignedOperatorId !== operatorId) {
    throw new AppError("FORBIDDEN", "這筆 Lead 已指派給其他操作者。");
  }
  await repo.insertAccessEvent({
    id: generateId("LAE"),
    leadId: claimed.lead.id,
    operatorId,
    action: "REVEAL_CONTACT",
    createdAt: nowTaipeiISOString(),
  });
  return { name: claimed.lead.contactName, phone: claimed.lead.contactPhone };
}

// 依 docs/LEAD_OPERATIONS.md §3。key 不存在的轉移一律不允許；value 為該轉移必填的原因碼
// （空陣列代表不需要原因碼）。CLOSED／CANCELLED 為終態，不出現在任何 key 的左邊。
const REASON_CODES_WITHDRAWN = ["USER_WITHDRAWN", "CONSENT_WITHDRAWN", "USER_DELETED", "UNREACHABLE", "INVALID", "DUPLICATE"];
const TRANSITIONS: Record<string, string[]> = {
  "NEW->CONTACTED": [],
  "NEW->CANCELLED": REASON_CODES_WITHDRAWN,
  "CONTACTED->ACCEPTED": [],
  "CONTACTED->CLOSED": ["NO_LONGER_NEEDED", "REFERRED_ELSEWHERE"],
  "CONTACTED->CANCELLED": REASON_CODES_WITHDRAWN,
  "ACCEPTED->CLOSED": ["CONNECTED", "PROVIDER_UNAVAILABLE"],
  "ACCEPTED->CANCELLED": REASON_CODES_WITHDRAWN,
};

export interface UpdateLeadStatusInput {
  leadId: string;
  toStatus: LeadStatus;
  reasonCode: string | null;
  note: string | null;
  operatorId: string;
}

export async function updateLeadStatus(repo: LeadRepository, input: UpdateLeadStatusInput): Promise<LeadStatusEvent> {
  const lead = await repo.findById(input.leadId);
  if (!lead) throw new AppError("NOT_FOUND", "找不到指定的 Lead。");

  const key = `${lead.status}->${input.toStatus}`;
  const requiredReasons = TRANSITIONS[key];
  if (requiredReasons === undefined) {
    throw new AppError("INVALID_STATUS_TRANSITION", `不允許的狀態轉移：${lead.status} -> ${input.toStatus}。`);
  }
  if (requiredReasons.length > 0 && (!input.reasonCode || !requiredReasons.includes(input.reasonCode))) {
    throw new AppError("VALIDATION_ERROR", `此轉移需要下列原因碼之一：${requiredReasons.join(", ")}。`);
  }

  const now = nowTaipeiISOString();
  const firstContactedAt = input.toStatus === "CONTACTED" && lead.firstContactedAt === null ? now : null;
  const closedAt = input.toStatus === "CLOSED" || input.toStatus === "CANCELLED" ? now : null;
  const eventId = generateId("LSE");

  // J-003-r8（問題 1）：CAS 狀態更新與 LeadStatusEvent 寫入必須同一交易完成（見 migration 0018
  // update_lead_status_with_event），不是分開的兩次呼叫——否則事件寫入失敗時狀態已經轉移，
  // 但歷程沒有對應事件，且無法用重試補回（重試會被「目前狀態已不是 expectedStatus」擋下）。
  const updated = await repo.updateLeadStatusWithEvent({
    leadId: lead.id,
    expectedStatus: lead.status,
    toStatus: input.toStatus,
    statusReason: input.reasonCode,
    firstContactedAt,
    closedAt,
    updatedAt: now,
    event: { id: eventId, reasonCode: input.reasonCode, note: input.note, operatorId: input.operatorId },
  });
  if (!updated) {
    throw new AppError("INVALID_STATUS_TRANSITION", "Lead 狀態已被其他操作變更，請重新查詢後再試一次。");
  }

  const event: LeadStatusEvent = {
    id: eventId,
    leadId: lead.id,
    fromStatus: lead.status,
    toStatus: input.toStatus,
    reasonCode: input.reasonCode,
    note: input.note,
    operatorId: input.operatorId,
    createdAt: now,
  };
  return event;
}
