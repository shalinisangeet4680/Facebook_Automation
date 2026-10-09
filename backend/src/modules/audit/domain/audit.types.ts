import { AuditActor } from "../infrastructure/audit.tables";

export interface AuditEntry {
  workspaceId: string;
  actor: AuditActor;
  actorId?: string | null;
  action: string;
  target?: string | null;
  data?: Record<string, unknown>;
}

export interface AuditEventView {
  id: string;
  actor: AuditActor;
  actorId: string | null;
  action: string;
  target: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}
