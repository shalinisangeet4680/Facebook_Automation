export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly traceId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FALLBACK = "Something went wrong. Please try again.";

export function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const b = body as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      traceId?: unknown;
    };
    return new ApiError(
      status,
      typeof b.code === "string" ? b.code : "UNKNOWN",
      typeof b.message === "string" ? b.message : FALLBACK,
      b.details && typeof b.details === "object" ? (b.details as Record<string, unknown>) : {},
      typeof b.traceId === "string" ? b.traceId : null,
    );
  }
  return new ApiError(status, status >= 500 ? "INTERNAL" : "UNKNOWN", FALLBACK);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Can't reach the server. Check your connection.";
  return FALLBACK;
}
