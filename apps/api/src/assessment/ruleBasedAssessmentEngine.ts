import type {
  AssessmentEngineContext,
  AssessmentEngineResult,
  CareAssessmentAIAdapter,
  RuleTrace,
} from "../adapters/aiAdapter.js";
import type { CareNeed, CreateAssessmentInput } from "../types/index.js";
import { AppError, KNOWLEDGE_UNAVAILABLE_MESSAGE } from "../errors/AppError.js";
import { KnowledgeView, type EngineDiagnostic } from "./knowledgeSnapshot.js";
import { composeSummary } from "./summaryComposer.js";
import {
  CARE_NEED_ORDER,
  KEYWORD_RULES,
  MANDATORY_WARNINGS,
  NEED_FIELD,
  NEGATION_WINDOW,
  NEGATION_WORDS,
  RULES_VERSION,
  SCORE_KEYWORD,
  SCORE_STRUCTURED,
  SCORE_USER_YES,
  STRUCTURED_RULES,
  priorityBonus,
} from "./rules.js";

// §4 比對規則 1：全形轉半形、移除空白與標點。
export function normalizeFreeText(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (code === 0x3000) out += " ";
    else if (code >= 0xff01 && code <= 0xff5e) out += String.fromCodePoint(code - 0xfee0);
    else out += ch;
  }
  return out.replace(/[\s\p{P}]/gu, "");
}

// §4 比對規則 2：關鍵字前 NEGATION_WINDOW 個字內出現否定詞，該次出現不算命中；任一次未被否定即命中。
export function matchesKeyword(normalized: string, keyword: string): boolean {
  let from = 0;
  for (;;) {
    const index = normalized.indexOf(keyword, from);
    if (index === -1) return false;
    const window = normalized.slice(Math.max(0, index - NEGATION_WINDOW), index);
    if (!NEGATION_WORDS.some((neg) => window.includes(neg))) return true;
    from = index + 1;
  }
}

// ASSESSMENT_RULES（RULES-2026-09-23-r2）的確定性規則引擎，實作既有 CareAssessmentAIAdapter 介面
// （介面名稱沿用，不做命名重構；TASK-B-010）。不呼叫任何外部 AI／LLM 服務，也不做任何 I/O：
// 同一輸入＋同一知識快照＋同一日期，輸出必定相同。
export class RuleBasedAssessmentEngine implements CareAssessmentAIAdapter {
  async generateCareNeedProfile(
    input: CreateAssessmentInput,
    context: AssessmentEngineContext
  ): Promise<AssessmentEngineResult> {
    const diagnostics: EngineDiagnostic[] = [];
    const view = new KnowledgeView(context.knowledge, context.today, diagnostics);

    // §2 步驟 2–4：使用者 YES／NO 優先；UNKNOWN 才依結構化規則，再依關鍵字補充。
    const normalized = normalizeFreeText(input.freeText ?? "");
    const needsTrace: RuleTrace["needs"] = [];
    const scores = new Map<CareNeed, number>();

    for (const need of CARE_NEED_ORDER) {
      const answer = input.needs[NEED_FIELD[need]];
      if (answer === "NO") continue;

      if (answer === "YES") {
        needsTrace.push({ need, basis: "USER_YES", ruleIds: [] });
        scores.set(need, SCORE_USER_YES + priorityBonus(need, input));
        continue;
      }

      const structured = STRUCTURED_RULES.filter((r) => r.need === need && r.applies(input)).map((r) => r.id);
      if (structured.length > 0) {
        needsTrace.push({ need, basis: "STRUCTURED_RULE", ruleIds: structured });
        scores.set(need, SCORE_STRUCTURED + priorityBonus(need, input));
        continue;
      }

      // 只記錄規則 ID，不保存命中片段（§4 比對規則 3）。
      const keywordRules = KEYWORD_RULES.filter(
        (r) => r.need === need && r.keywords.some((k) => matchesKeyword(normalized, k))
      ).map((r) => r.id);
      if (keywordRules.length > 0) {
        needsTrace.push({ need, basis: "KEYWORD", ruleIds: keywordRules });
        scores.set(need, SCORE_KEYWORD + priorityBonus(need, input));
      }
    }

    const careNeeds = CARE_NEED_ORDER.filter((n) => scores.has(n));
    // §5：分數高者在前；同分依固定順序（Array.prototype.sort 為穩定排序）。
    const priority = [...careNeeds].sort((a, b) => (scores.get(b) as number) - (scores.get(a) as number));

    // §6：summary 只由模板組成，值只從同一個 PUBLISHED 版本快照讀取。
    const composition = composeSummary(input, priority, view);
    if (!composition.nextStepAvailable) {
      throw new AppError("KNOWLEDGE_UNAVAILABLE", KNOWLEDGE_UNAVAILABLE_MESSAGE);
    }

    return {
      profile: {
        careNeeds,
        priority,
        summary: composition.lines.join("\n"),
        warnings: [...MANDATORY_WARNINGS],
      },
      rulesVersion: RULES_VERSION,
      ruleTrace: {
        needs: needsTrace,
        templateIds: composition.templateIds,
        knowledgeRecordIds: composition.knowledgeRecordIds,
      },
      diagnostics,
    };
  }
}
