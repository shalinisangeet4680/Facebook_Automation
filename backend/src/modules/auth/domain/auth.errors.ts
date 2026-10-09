import { CodedError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

export const phoneNotAllowed = () =>
  new CodedError(
    ErrorCode.PHONE_NOT_ALLOWED,
    403,
    "This number isn't on the early-access list yet.",
  );

export const otpInvalid = (attemptsLeft: number) =>
  new CodedError(
    ErrorCode.OTP_INVALID,
    422,
    attemptsLeft > 0
      ? `That code is incorrect. ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`
      : "That code is incorrect. Request a new code to try again.",
    { attemptsLeft },
  );

export const otpExpired = () =>
  new CodedError(
    ErrorCode.OTP_EXPIRED,
    422,
    "This code has expired. Request a new one.",
  );

export const otpTooSoon = (retryAfterSeconds: number) =>
  new CodedError(
    ErrorCode.TOO_MANY_REQUESTS,
    429,
    `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
    { retryAfterSeconds },
  );

export const sessionEnded = () =>
  new CodedError(
    ErrorCode.UNAUTHORIZED,
    401,
    "Your session has ended. Please sign in again.",
  );

export const sessionRefreshedElsewhere = () =>
  new CodedError(
    ErrorCode.SESSION_REFRESHED,
    409,
    "Your session was just refreshed. Retry the request.",
  );
