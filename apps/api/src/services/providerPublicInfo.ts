import type { ProviderPublicInfo } from "../types/index.js";
// One whitelist at the import and response boundary; public directory fields only.
export function isProviderPublicInfo(value: unknown): value is ProviderPublicInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = ["assistivePrograms", "publicServices", "notice", "sourceUrl", "checkedAt"];
  if (Object.keys(v).length !== keys.length || !keys.every(k => k in v)) return false;
  if (!Array.isArray(v.assistivePrograms) || !v.assistivePrograms.every(x => x === "PURCHASE" || x === "SMART_TECH") || new Set(v.assistivePrograms).size !== v.assistivePrograms.length) return false;
  if (!Array.isArray(v.publicServices) || !v.publicServices.every(x => typeof x === "string" && x.trim().length > 0 && x.length <= 250)) return false;
  if (!(v.notice === null || typeof v.notice === "string" && v.notice.length <= 1000)) return false;
  if (typeof v.checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.checkedAt)) return false;
  try { return typeof v.sourceUrl === "string" && new URL(v.sourceUrl).protocol === "https:"; } catch { return false; }
}
