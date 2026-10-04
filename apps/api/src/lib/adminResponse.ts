// TASK-B-012：所有 /api/v1/admin/** 回應一律 Cache-Control: no-store（API_CONTRACT §26.1）。
import { successResponse, errorResponse, internalErrorResponse, type HttpResponse } from "./response.js";
import { AppError } from "../errors/AppError.js";

function noStore(res: HttpResponse): HttpResponse {
  return { ...res, headers: { ...res.headers, "Cache-Control": "no-store" } };
}

export function adminSuccessResponse<T>(data: T, statusCode = 200): HttpResponse {
  return noStore(successResponse(data, statusCode));
}

export function adminErrorResponse(err: AppError): HttpResponse {
  return noStore(errorResponse(err));
}

export function adminInternalErrorResponse(): HttpResponse {
  return noStore(internalErrorResponse());
}
