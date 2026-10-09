import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { FastifyReply, FastifyRequest } from "fastify";

import { DomainError } from "./domain-error";
import { ErrorCode } from "./error-codes";

const STATUS_CODES: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.TOO_MANY_REQUESTS,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

interface ErrorBody {
  code: ErrorCode | string;
  message: string;
  traceId: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const traceId = String(request.id);
    const { status, body } = this.toError(exception, traceId);

    if (status >= 500) {
      this.logger.error(
        `${traceId} ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void response.status(status).send(body);
  }

  private toError(
    exception: unknown,
    traceId: string,
  ): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      return {
        status: exception.httpStatus,
        body: {
          code: exception.code,
          message: exception.message,
          traceId,
          details: exception.details,
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          code: ErrorCode.TOO_MANY_REQUESTS,
          message: "Too many attempts. Please wait a minute and try again.",
          traceId,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === "string"
          ? res
          : Array.isArray((res as { message?: unknown }).message)
            ? String((res as { message: string[] }).message[0])
            : String(
                (res as { message?: unknown }).message ?? exception.message,
              );
      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        return {
          status,
          body: {
            code: ErrorCode.SERVICE_UNAVAILABLE,
            message: "A required service is unavailable.",
            traceId,
            details: (res as { error?: unknown }).error,
          },
        };
      }
      return {
        status,
        body: {
          code: STATUS_CODES[status] ?? ErrorCode.BAD_REQUEST,
          message,
          traceId,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ErrorCode.INTERNAL,
        message: "Something went wrong. Please try again.",
        traceId,
      },
    };
  }
}
