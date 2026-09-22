import type { ExternalService, ExternalServiceResponse } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

// 依 tasks/TASK-B-007.md：本 Task 很小，僅固定回傳 Kareocar 外部服務資訊，
// 不得趁機做 Kareocar backend integration（不接資料庫、不共用 Auth、不做派車）。
// 依 docs/DATA_MODEL.md 第 29 節範例資料建立。
const KAREOCAR_EXTERNAL_SERVICE: ExternalService = {
  id: "EXT-001",
  name: "Kareocar",
  serviceType: "TRANSPORTATION",
  url: "https://kareocar.netlify.app/",
  active: true,
};

const KAREOCAR_NOTICE = "此服務將前往外部 Kareocar 平台。";

// 目前 MVP 只有 Kareocar 一個 ExternalService，serviceType 只能是 "transportation"。
// 未來若有其他 ExternalService，屬於超出本 Task 範圍的擴充，需另立 Task。
export function getTransportationExternalService(): ExternalServiceResponse {
  if (!KAREOCAR_EXTERNAL_SERVICE.active) {
    throw new AppError("NOT_FOUND", "目前 Kareocar 服務暫不可用。");
  }

  return {
    id: KAREOCAR_EXTERNAL_SERVICE.id,
    name: KAREOCAR_EXTERNAL_SERVICE.name,
    serviceType: KAREOCAR_EXTERNAL_SERVICE.serviceType,
    url: KAREOCAR_EXTERNAL_SERVICE.url,
    openMode: "NEW_TAB",
    notice: KAREOCAR_NOTICE,
  };
}
