import { createAssessment } from "../services/assessmentService.js";
import { SupabaseSessionRepository } from "../repositories/supabaseSessionRepository.js";
import { SupabaseConsentRepository } from "../repositories/supabaseConsentRepository.js";
import { SupabaseAssessmentRepository } from "../repositories/supabaseAssessmentRepository.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import { RuleBasedAssessmentEngine } from "../assessment/ruleBasedAssessmentEngine.js";
import { DatabaseKnowledgeResolver } from "../adapters/knowledgeVersionResolver.js";
import { requireValidSession } from "../services/sessionSecurityService.js";
import { enforceRateLimit, RATE_LIMIT_RULES } from "../services/rateLimitService.js";
import { requireBodySize } from "../services/requestLimitsService.js";
import { successResponse, internalErrorResponse, errorResponse, nowTaipeiISOString, type HttpResponse } from "../lib/response.js";
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

  try {
    requireBodySize(event.body);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }

  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : {};
  } catch {
    return errorResponse(new AppError("INVALID_REQUEST", "請求 Body 不是合法 JSON。"));
  }

  try {
    // 依 ARCHITECTURE §20.4：Assessment 3 次／小時，鍵為 session id——必須先確認是有效 session
    // 才有 key 可用；這裡的驗證跟 createAssessment 內部自己做的驗證重複一次（都只是查詢，非寫入，
    // 不影響正確性），換取不必重構每個 Service 的簽章來傳遞 rate limit repo。
    const sessionRepo = new SupabaseSessionRepository();
    const session = await requireValidSession(sessionRepo, getSessionTokenHeader(event));
    await enforceRateLimit(new SupabaseRateLimitRepository(), RATE_LIMIT_RULES.ASSESSMENT, session.id, nowTaipeiISOString());

    const result = await createAssessment(
      {
        sessionRepo,
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
