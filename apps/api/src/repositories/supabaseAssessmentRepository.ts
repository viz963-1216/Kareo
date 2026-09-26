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

  async findById(id: string): Promise<Assessment | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("assessments")
      .select(
        "id, session_id, age_range, city, district, location_precision, lat, lng, living_situation, caregiver_situation, mobility_level, daily_living_level, home_care_need, medical_nursing_need, assistive_device_need, transportation_need, free_text, status, knowledge_version, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "無法查詢 Assessment，請稍後再試。", { cause: error });
    if (!data) return null;

    return {
      id: data.id,
      sessionId: data.session_id,
      ageRange: data.age_range,
      city: data.city,
      district: data.district,
      locationPrecision: data.location_precision,
      lat: data.lat,
      lng: data.lng,
      livingSituation: data.living_situation,
      caregiverSituation: data.caregiver_situation,
      mobilityLevel: data.mobility_level,
      dailyLivingLevel: data.daily_living_level,
      homeCareNeed: data.home_care_need,
      medicalNursingNeed: data.medical_nursing_need,
      assistiveDeviceNeed: data.assistive_device_need,
      transportationNeed: data.transportation_need,
      freeText: data.free_text,
      status: data.status,
      knowledgeVersion: data.knowledge_version,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
