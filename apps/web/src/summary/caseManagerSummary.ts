import type { AssessmentResponse, CareNeed } from "../types/api";

export const careNeedLabels: Record<CareNeed, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
  TRANSPORTATION: "長照交通",
};

export const FORMAL_ASSESSMENT_REMINDER = [
  "本平台提供的結果僅為初步預估，不代表正式長照資格、長照等級或補助核定結果。",
  "實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心進行正式評估確認。",
];

export const CASE_MANAGER_QUESTIONS = [
  "我的情況需要申請長照需要等級評估嗎？要準備哪些資料？",
  "評估後大約多久會有照管專員聯繫或到府評估？",
  "依我的情況，可能可以使用哪些服務（居家照顧、喘息、輔具、交通接送、居家醫護）？",
  "我的部分負擔比例與給付額度要如何確認？",
  "輔具或居家無障礙改善補助，需要先評估或核定後才能購買嗎？要找哪裡的特約廠商？",
] as const;

export interface CaseManagerSummaryModel {
  generatedDate: string;
  knowledgeVersion: string;
  careNeeds: string[];
  priority: string[];
  summaryLines: string[];
}

export function buildCaseManagerSummary(result: AssessmentResponse, generatedDate: string): CaseManagerSummaryModel {
  return {
    generatedDate,
    knowledgeVersion: result.knowledgeVersion,
    careNeeds: result.careNeedProfile.careNeeds.map((need) => careNeedLabels[need]),
    priority: result.careNeedProfile.priority.map((need) => careNeedLabels[need]),
    summaryLines: result.careNeedProfile.summary.split("\n").map((line) => line.trim()).filter(Boolean),
  };
}

export function caseManagerSummaryText(model: CaseManagerSummaryModel) {
  const needs = model.careNeeds.length ? model.careNeeds.map((need) => `- ${need}`) : ["- 本次初評沒有辨識出明確服務需求"];
  const priority = model.priority.length ? model.priority.map((need, index) => `${index + 1}. ${need}`) : ["- 無"];
  return [
    "給個管師／1966 的需求摘要",
    ...FORMAL_ASSESSMENT_REMINDER,
    "本摘要為初步預估，不代表正式資格或補助核定。",
    "",
    "可能需要的服務",
    ...needs,
    "",
    "建議優先處理順序",
    ...priority,
    "",
    "初步照護建議與補助說明",
    ...model.summaryLines,
    "",
    `知識版本：${model.knowledgeVersion}`,
    `產生日期：${model.generatedDate}`,
    "",
    "建議詢問 1966／照管專員的問題",
    ...CASE_MANAGER_QUESTIONS.map((question, index) => `${index + 1}. ${question}`),
    "",
    ...FORMAL_ASSESSMENT_REMINDER,
    "本摘要為初步預估，不代表正式資格或補助核定。",
  ].join("\n");
}
