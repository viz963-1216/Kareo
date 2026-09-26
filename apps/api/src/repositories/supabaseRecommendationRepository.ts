import { getSupabaseClient } from "./supabaseClient.js";
import type { RecommendationRepository } from "./types.js";
import type { RecommendationItem, RecommendationRun } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

export class SupabaseRecommendationRepository implements RecommendationRepository {
  async insertRun(run: RecommendationRun): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from("recommendation_runs").insert({
      id: run.id,
      assessment_id: run.assessmentId,
      service_type: run.serviceType,
      ranking_type: run.rankingType,
      location_precision: run.locationPrecision,
      knowledge_version: run.knowledgeVersion,
      created_at: run.createdAt,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "無法寫入 RecommendationRun，請稍後再試。", { cause: error });
  }

  async insertItems(items: RecommendationItem[]): Promise<void> {
    if (items.length === 0) return;
    const client = getSupabaseClient();
    const { error } = await client.from("recommendation_items").insert(
      items.map((item) => ({
        id: item.id,
        recommendation_run_id: item.recommendationRunId,
        provider_id: item.providerId,
        rank: item.rank,
        score: item.score,
        distance_km: item.distanceKm,
        reasons: item.reasons,
        created_at: item.createdAt,
      }))
    );
    if (error) throw new AppError("INTERNAL_ERROR", "無法寫入 RecommendationItem，請稍後再試。", { cause: error });
  }
}
