import type { AssessmentResponse } from "../types/api";
import { careNeedLabels } from "./caseManagerSummary.ts";

/** A short orientation using only structured needs; policy details remain verbatim. */
export function assessmentOverview(result: AssessmentResponse): string {
  const { careNeeds, priority } = result.careNeedProfile;
  const needs = [...new Set(careNeeds)];
  const first = priority.find((need) => needs.includes(need));
  const introduction = needs.length
    ? `依目前資料，可能需要${needs.map((need) => careNeedLabels[need]).join("、")}。`
    : "本次初評未辨識出明確服務需求，但不代表沒有長照需求。";
  const next = first ? `建議優先與個管師討論${careNeedLabels[first]}。` : "可向 1966 諮詢或補充照護狀況。";
  return `${introduction}${next}制度、補助及自付資訊請見完整說明。此為初步預估；實際資格、等級、服務及補助，須由 1966 或所在地長期照顧管理中心正式評估確認。`;
}
