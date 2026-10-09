import { ErrorCode } from "./error-codes";

export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code: ErrorCode = ErrorCode.VALIDATION;
  readonly httpStatus = 400;
}

export class UnauthorizedError extends DomainError {
  readonly code: ErrorCode = ErrorCode.UNAUTHORIZED;
  readonly httpStatus = 401;
}

export class ForbiddenError extends DomainError {
  readonly code: ErrorCode = ErrorCode.FORBIDDEN;
  readonly httpStatus = 403;
}

export class NotFoundError extends DomainError {
  readonly code: ErrorCode = ErrorCode.NOT_FOUND;
  readonly httpStatus = 404;
}

export class TooManyRequestsError extends DomainError {
  readonly code: ErrorCode = ErrorCode.TOO_MANY_REQUESTS;
  readonly httpStatus = 429;
}

export class CodedError extends DomainError {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

export class ProtocolError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly body: Record<string, unknown>,
    readonly headers: Record<string, string> = {},
  ) {
    const message = body.error_description ?? body.error;
    super(typeof message === "string" ? message : "Protocol error");
    this.name = "ProtocolError";
  }
}
