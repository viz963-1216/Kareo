import { ApiError } from "../api/realAdapter";

// A missing route is a fault, not evidence that a product has intentionally not opened.
export function knowledgeFailure(error: unknown): "unpublished" | "error" {
  return error instanceof ApiError && error.code === "KNOWLEDGE_UNAVAILABLE" ? "unpublished" : "error";
}

export function publicDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "待補";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
