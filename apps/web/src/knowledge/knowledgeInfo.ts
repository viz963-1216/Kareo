import type { KnowledgeCategory, KnowledgeJurisdiction, KnowledgeRecordsRequest } from "../types/api";

export interface KnowledgeFilters {
  jurisdiction: "" | KnowledgeJurisdiction;
  category: "" | KnowledgeCategory;
}

export const initialKnowledgeFilters: KnowledgeFilters = { jurisdiction: "", category: "" };

export function knowledgeRequest(filters: KnowledgeFilters, page = 1): KnowledgeRecordsRequest {
  return {
    ...(filters.jurisdiction ? { jurisdiction: filters.jurisdiction } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    page: Math.max(1, page),
    pageSize: 20,
  };
}

export function knowledgeSummaryParagraphs(summary: string) {
  return summary.split("\n").map((line) => line.trim()).filter(Boolean);
}

export const previousKnowledgePage = (page: number) => Math.max(1, page - 1);
