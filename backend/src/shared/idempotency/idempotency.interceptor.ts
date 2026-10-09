import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { from, Observable, of, throwError } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";

import { CodedError, UnauthorizedError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";
import { CryptoService } from "@shared/security/crypto.service";

import { IdempotencyRepository } from "./idempotency.repository";

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly keys: IdempotencyRepository,
    private readonly crypto: CryptoService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const workspaceId = request.auth?.workspaceId;
    if (!workspaceId)
      throw new UnauthorizedError("Please sign in to continue.");

    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
      throw new CodedError(
        ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
        400,
        "This action needs an Idempotency-Key header.",
      );
    }
    const requestHash = this.crypto.hash(
      `${request.method}:${request.url}:${JSON.stringify(request.body ?? null)}`,
    );

    return from(this.begin(workspaceId, key, requestHash)).pipe(
      mergeMap((replay) => {
        if (replay) {
          void reply.status(replay.statusCode);
          return of(replay.response);
        }
        return next.handle().pipe(
          mergeMap((response) =>
            from(
              this.keys.complete(workspaceId, key, reply.statusCode, response),
            ).pipe(mergeMap(() => of(response))),
          ),
          catchError((err: unknown) =>
            from(this.keys.release(workspaceId, key)).pipe(
              mergeMap(() => throwError(() => err)),
            ),
          ),
        );
      }),
    );
  }

  private async begin(
    workspaceId: string,
    key: string,
    requestHash: string,
  ): Promise<{ statusCode: number; response: unknown } | null> {
    const claimed = await this.keys.claim({
      workspaceId,
      key,
      requestHash,
      expiresAt: new Date(Date.now() + TTL_MS),
    });
    if (claimed) return null;

    const existing = await this.keys.find(workspaceId, key);
    if (!existing) return this.begin(workspaceId, key, requestHash);
    if (existing.requestHash !== requestHash) {
      throw new CodedError(
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
        422,
        "This Idempotency-Key was already used for a different request.",
      );
    }
    if (existing.statusCode === null) {
      throw new CodedError(
        ErrorCode.IDEMPOTENCY_IN_PROGRESS,
        409,
        "This action is already being processed.",
      );
    }
    return { statusCode: existing.statusCode, response: existing.response };
  }
}
