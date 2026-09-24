import { getSupabaseClient } from "./supabaseClient.js";
import type { AssessmentRepository, CreateAssessmentRecord } from "./types.js";
import type { Assessment, CareNeedProfile } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export class SupabaseAssessmentRepository implements AssessmentRepository {
  async createAssessment(
    input: CreateAssessmentRecord
  ): Promise<{ assessment: Assessment; careNeedProfile: CareNeedProfile }> {
    const client = getSupabaseClient();
    const now = nowTaipeiISOString();

    const assessment: Assessment = {
      ...input.assessment,
      id: generateId("ASM"),
      createdAt: now,
      updatedAt: now,
    };
    const careNeedProfile: CareNeedProfile = {
      ...input.careNeedProfile,
      id: generateId("CNP"),
      assessmentId: assessment.id,
      createdAt: now,
    };

    // 依 ARCHITECTURE §22 / D-10 的原子寫入模式：兩張表在同一個 Postgres function（同一個交易）內寫入，
    // 任一步失敗整個交易回滾，不會留下沒有 CareNeedProfile 的 COMPLETED Assessment（migration 0009）。
    const { error } = await client.rpc("create_assessment_with_profile", {
      payload: {
        assessment: {
          id: assessment.id,
          session_id: assessment.sessionId,
          age_range: assessment.ageRange,
          city: assessment.city,
          district: assessment.district,
          location_precision: assessment.locationPrecision,
          lat: assessment.lat,
          lng: assessment.lng,
          living_situation: assessment.livingSituation,
          caregiver_situation: assessment.caregiverSituation,
          mobility_level: assessment.mobilityLevel,
          daily_living_level: assessment.dailyLivingLevel,
          disability_certificate: assessment.disabilityCertificate,
          income_category: assessment.incomeCategory,
          home_care_need: assessment.homeCareNeed,
          medical_nursing_need: assessment.medicalNursingNeed,
          assistive_device_need: assessment.assistiveDeviceNeed,
          transportation_need: assessment.transportationNeed,
          free_text: assessment.freeText,
          status: assessment.status,
          knowledge_version: assessment.knowledgeVersion,
          rules_version: assessment.rulesVersion,
          rule_trace: assessment.ruleTrace,
          created_at: assessment.createdAt,
          updated_at: assessment.updatedAt,
        },
        care_need_profile: {
          id: careNeedProfile.id,
          assessment_id: careNeedProfile.assessmentId,
          care_needs: careNeedProfile.careNeeds,
          priority: careNeedProfile.priority,
          summary: careNeedProfile.summary,
          warnings: careNeedProfile.warnings,
          created_at: careNeedProfile.createdAt,
        },
      },
    });

    // 不把資料庫錯誤原文帶出（可能含 SQL、欄位值或自由文字）。
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法建立 Assessment，請稍後再試。");
    }

    return { assessment, careNeedProfile };
  }
}
