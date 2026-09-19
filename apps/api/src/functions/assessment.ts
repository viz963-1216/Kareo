import { createAssessment } from "../services/assessmentService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { SupabaseAssessmentRepository } from "../repositories/supabaseAssessmentRepository.js";
import { FakeAssessmentAIAdapter } from "../adapters/fakeAssessmentAIAdapter.js";
import { NullKnowledgeVersionResolver } from "../adapters/knowledgeVersionResolver.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
}

// 正式 AI Provider（OpenAI / Claude / Gemini）尚未拍板，依 tasks/TASK-B-003.md「AI Adapter Rule」，
// 目前線上一律使用 Deterministic Fake Adapter，待未來 Task 決定並接上真實 Provider 後在此替換。
// Knowledge DB（TASK-B-008）尚未實作，因此使用 NullKnowledgeVersionResolver，
// 這會讓所有正式 Assessment 目前回 KNOWLEDGE_UNAVAILABLE，是刻意的安全行為，不是 Bug。
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
        aiAdapter: new FakeAssessmentAIAdapter(),
        knowledgeVersionResolver: new NullKnowledgeVersionResolver(),
      },
      parsedBody
    );

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
