import type { ApiErrorBody, ApiErrorCode } from "@contracts";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly failures?: string[];
  readonly requestId?: string;

  constructor(
    readonly status: number,
    body: ApiErrorBody["error"],
  ) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.failures = body.failures;
    this.requestId = body.requestId;
  }
}
