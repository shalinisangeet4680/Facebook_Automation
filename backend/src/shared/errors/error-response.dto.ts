export class ErrorResponseDto {
  code: string;
  message: string;
  traceId: string;
  details?: Record<string, unknown>;
}
