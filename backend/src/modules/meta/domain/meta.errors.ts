import { CodedError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

export const metaTokenInvalid = (reason?: string) =>
  new CodedError(
    ErrorCode.META_TOKEN_INVALID,
    422,
    "This token is invalid or expired. Generate a new one and paste it again.",
    reason ? { reason } : undefined,
  );

export const metaUnavailable = () =>
  new CodedError(
    ErrorCode.META_UNAVAILABLE,
    502,
    "Meta isn't responding right now. Please try again in a minute.",
  );

export const metaThrottled = (retryAfterSeconds: number) =>
  new CodedError(
    ErrorCode.META_THROTTLED,
    429,
    "Meta is limiting requests for this account. Please try again shortly.",
    { retryAfterSeconds },
  );

export const metaNotConnected = () =>
  new CodedError(
    ErrorCode.META_NOT_CONNECTED,
    409,
    "Connect your Meta account first.",
  );

export const metaRejected = (
  message: string,
  details?: Record<string, unknown>,
) => new CodedError(ErrorCode.META_REJECTED, 422, message, details);
