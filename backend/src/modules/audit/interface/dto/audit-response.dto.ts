export class AuditEventDto {
  id: string;
  actor: "user" | "system" | "ai";
  actorId: string | null;
  action: string;
  target: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export class AuditPageResponseDto {
  data: AuditEventDto[];
  nextCursor: string | null;
}
