import { applyDecorators, SetMetadata, UseInterceptors } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";

import { IdempotencyInterceptor } from "./idempotency.interceptor";

export const IDEMPOTENT = "idempotent";

export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT, true),
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({ name: "Idempotency-Key", required: true }),
  );
