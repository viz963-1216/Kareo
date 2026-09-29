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

export async function revealContact(
  repo: LeadRepository,
  leadId: string,
  operatorId: string
): Promise<{ name: string | null; phone: string | null }> {
  const lead = await repo.findById(leadId);
  if (!lead) throw new AppError("NOT_FOUND", "找不到指定的 Lead。");
  await repo.insertAccessEvent({
    id: generateId("LAE"),
    leadId: lead.id,
    operatorId,
    action: "REVEAL_CONTACT",
    createdAt: nowTaipeiISOString(),
  });
  return { name: lead.contactName, phone: lead.contactPhone };
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

  // Compare-and-set：以讀取當下的狀態為條件，避免兩位操作者同時改動同一筆 Lead（LEAD_OPERATIONS §4）。
  const updated = await repo.updateLeadStatus({
    id: lead.id,
    expectedStatus: lead.status,
    toStatus: input.toStatus,
    statusReason: input.reasonCode,
    firstContactedAt,
    closedAt,
    updatedAt: now,
  });
  if (!updated) {
    throw new AppError("INVALID_STATUS_TRANSITION", "Lead 狀態已被其他操作變更，請重新查詢後再試一次。");
  }

  const event: LeadStatusEvent = {
    id: generateId("LSE"),
    leadId: lead.id,
    fromStatus: lead.status,
    toStatus: input.toStatus,
    reasonCode: input.reasonCode,
    note: input.note,
    operatorId: input.operatorId,
    createdAt: now,
  };
  await repo.insertStatusEvent(event);
  return event;
}
