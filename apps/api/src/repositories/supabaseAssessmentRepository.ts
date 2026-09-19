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

    const { error: assessmentError } = await client.from("assessments").insert({
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
      home_care_need: assessment.homeCareNeed,
      medical_nursing_need: assessment.medicalNursingNeed,
      assistive_device_need: assessment.assistiveDeviceNeed,
      transportation_need: assessment.transportationNeed,
      free_text: assessment.freeText,
      status: assessment.status,
      knowledge_version: assessment.knowledgeVersion,
      created_at: assessment.createdAt,
      updated_at: assessment.updatedAt,
    });

    if (assessmentError) {
      throw new AppError("INTERNAL_ERROR", "無法建立 Assessment，請稍後再試。");
    }

    const careNeedProfile: CareNeedProfile = {
      ...input.careNeedProfile,
      id: generateId("CNP"),
      assessmentId: assessment.id,
      createdAt: now,
    };

    const { error: profileError } = await client.from("care_need_profiles").insert({
      id: careNeedProfile.id,
      assessment_id: careNeedProfile.assessmentId,
      care_needs: careNeedProfile.careNeeds,
      priority: careNeedProfile.priority,
      summary: careNeedProfile.summary,
      warnings: careNeedProfile.warnings,
      created_at: careNeedProfile.createdAt,
    });

    if (profileError) {
      throw new AppError("INTERNAL_ERROR", "無法建立 CareNeedProfile，請稍後再試。");
    }

    return { assessment, careNeedProfile };
  }
}
