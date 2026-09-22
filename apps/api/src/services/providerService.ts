import type { ProviderRepository } from "../repositories/types.js";
import type { ProviderDetailResponse } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 依 tasks/TASK-B-004.md：GET /api/v1/providers/{providerId}，符合 API_CONTRACT.md 第 10 節。
export async function getProviderDetail(
  repo: ProviderRepository,
  providerId: unknown
): Promise<ProviderDetailResponse> {
  if (!isNonEmptyString(providerId)) {
    throw new AppError("VALIDATION_ERROR", "缺少有效的 providerId。");
  }

  const provider = await repo.findDetailById(providerId);
  if (!provider) {
    throw new AppError("NOT_FOUND", "找不到指定的服務單位。");
  }

  return provider;
}
