import { getTransportationExternalService } from "../services/externalServiceService.js";
import { successResponse, internalErrorResponse, errorResponse, type HttpResponse } from "../lib/response.js";
import { AppError } from "../errors/AppError.js";

interface NetlifyEvent {
  httpMethod: string;
}

// GET /api/v1/external-services/transportation
// 依 tasks/TASK-B-007.md：僅回傳固定的 External Link 資訊，禁止 iframe、
// Backend Integration、Database Integration、Authentication Integration。
export async function handler(event: NetlifyEvent): Promise<HttpResponse> {
  if (event.httpMethod !== "GET") {
    return errorResponse(new AppError("INVALID_REQUEST", "僅支援 GET /api/v1/external-services/transportation。"));
  }

  try {
    const data = getTransportationExternalService();
    return successResponse(data);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalErrorResponse();
  }
}
