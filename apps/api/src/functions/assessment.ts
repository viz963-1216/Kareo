import { createAssessment } from "../services/assessmentService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { SupabaseAssessmentRepository } from "../repositories/supabaseAssessmentRepository.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { RuleBasedAssessmentEngine } from "../assessment/ruleBasedAssessmentEngine.js";
import { DatabaseKnowledgeResolver } from "../adapters/knowledgeVersionResolver.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { getSessionTokenHeader } from "../lib/headers.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers?: Record<string, string | undefined> | null;
}

// TASK-B-010：正式組裝 ASSESSMENT_RULES 規則引擎（D-01：MVP 不使用 AI）＋ B-008 的 PUBLISHED Knowledge。
// 不得組裝 Fake Adapter、Fake/Null Knowledge resolver 或測試知識；沒有 PUBLISHED 版本時回 KNOWLEDGE_UNAVAILABLE。
// Session token（X-Kareo-Session-Token）驗證由 B-011a 提供，合併 B-011a 後於此加上，B-010 不另建一套。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "POST") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 POST /api/v1/assessments。"));
  }

  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch {
    return errorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    const result = await createAssessment(
      {
        sessionRepo: new SupabaseSessionRepository(),
        consentRepo: new SupabaseConsentRepository(),
        assessmentRepo: new SupabaseAssessmentRepository(),
        aiAdapter: new RuleBasedAssessmentEngine(),
        knowledgeResolver: new DatabaseKnowledgeResolver(new SupabaseKnowledgeRepository()),
      },
      parsedBody,
      getSessionTokenHeader(event)
    );

    // rulesVersion／ruleTrace 只存資料庫，不回傳前端（DATA_MODEL v0.2.2 §7）。
    return successResponse({
      assessmentId: result.assessment.id,
      knowledgeVersion: result.assessment.knowledgeVersion,
      careNeedProfile: {
        id: result.careNeedProfile.id,
        careNeeds: result.careNeedProfile.careNeeds,
        priority: result.careNeedProfile.priority,
        summary: result.careNeedProfile.summary,
        warnings: result.careNeedProfile.warnings,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
