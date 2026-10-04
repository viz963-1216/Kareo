import { getSupabaseClient } from "./supabaseClient.js";
import type { RecommendationRepository, SessionWriteContext } from "./types.js";
import type { RecommendationItem, RecommendationRun } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

export const CREATE_RECOMMENDATION_RESULT_RPC = "create_recommendation_authorized";

// Jerry 委託修正第二輪（2026-09-26）：Run 與 Items 原本分兩次獨立 REST insert 寫入，Items 失敗會留下
// 沒有 Items、卻可能被後續 Lead 誤用的孤立 Run。改為 insertRun 只在呼叫端暫存，insertItems 才透過
// 單一 RPC（依 ARCHITECTURE §22，擴大核准範圍比照 import_provider_dataset 的既有模式）在同一個交易
// 內寫入兩張表，任一步失敗整個交易回滾，不留半套資料；介面（insertRun／insertItems 的呼叫順序）
// 不變；正式 service 在 insertRun 傳入已驗證 token 的雜湊及 session id，最終 SQL 再次驗證。
export class SupabaseRecommendationRepository implements RecommendationRepository {
  private pendingRun: RecommendationRun | null = null;
  private pendingSecurity: SessionWriteContext | null = null;

  async insertRun(run: RecommendationRun, security?: SessionWriteContext): Promise<void> {
    if (!security) throw new AppError("SESSION_INVALID", "Session 已失效，請重新開始。");
    this.pendingRun = run;
    this.pendingSecurity = security;
  }

  async insertItems(items: RecommendationItem[]): Promise<void> {
    if (!this.pendingRun) throw new AppError("INTERNAL_ERROR", "insertItems 呼叫前必須先呼叫 insertRun。");
    const run = this.pendingRun;
    const security = this.pendingSecurity;
    this.pendingSecurity = null;
    this.pendingRun = null;

    const client = getSupabaseClient();
    const { error } = await client.rpc(CREATE_RECOMMENDATION_RESULT_RPC, {
      payload: {
        ...security,
        run: {
          id: run.id,
          assessment_id: run.assessmentId,
          service_type: run.serviceType,
          ranking_type: run.rankingType,
          location_precision: run.locationPrecision,
          knowledge_version: run.knowledgeVersion,
          created_at: run.createdAt,
        },
        items: items.map((item) => ({
          id: item.id,
          recommendation_run_id: item.recommendationRunId,
          provider_id: item.providerId,
          rank: item.rank,
          score: item.score,
          distance_km: item.distanceKm,
          reasons: item.reasons,
          created_at: item.createdAt,
        })),
      },
    });

    if (error) {
      if (error.message?.startsWith("SESSION_INVALID:")) throw new AppError("SESSION_INVALID", "Session 已失效，請重新開始。");
      if (error.message?.startsWith("CONSENT_REQUIRED:")) throw new AppError("CONSENT_REQUIRED", "請先完成服務說明與免責聲明同意。");
      if (error.message?.startsWith("NOT_FOUND:")) throw new AppError("NOT_FOUND", "找不到指定的評估結果。");
      throw new AppError("INTERNAL_ERROR", "無法寫入推薦結果，請稍後再試。");
    }
  }

  async findRunWithItems(id: string): Promise<{ run: RecommendationRun; items: RecommendationItem[] } | null> {
    const client = getSupabaseClient();
    const { data: runRow, error: runError } = await client
      .from("recommendation_runs")
      .select("id, assessment_id, service_type, ranking_type, location_precision, knowledge_version, created_at")
      .eq("id", id)
      .maybeSingle();
    if (runError) throw new AppError("INTERNAL_ERROR", "無法查詢推薦結果，請稍後再試。", { cause: runError });
    if (!runRow) return null;

    const { data: itemRows, error: itemsError } = await client
      .from("recommendation_items")
      .select("id, recommendation_run_id, provider_id, rank, score, distance_km, reasons, created_at")
      .eq("recommendation_run_id", id);
    if (itemsError) throw new AppError("INTERNAL_ERROR", "無法查詢推薦結果，請稍後再試。", { cause: itemsError });

    return {
      run: {
        id: runRow.id,
        assessmentId: runRow.assessment_id,
        serviceType: runRow.service_type,
        rankingType: runRow.ranking_type,
        locationPrecision: runRow.location_precision,
        knowledgeVersion: runRow.knowledge_version,
        createdAt: runRow.created_at,
      },
      items: (itemRows ?? []).map((r) => ({
        id: r.id,
        recommendationRunId: r.recommendation_run_id,
        providerId: r.provider_id,
        rank: r.rank,
        score: r.score,
        distanceKm: r.distance_km,
        reasons: r.reasons,
        createdAt: r.created_at,
      })),
    };
  }
}
