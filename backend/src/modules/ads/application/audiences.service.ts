import { Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
import {
  CodedError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

import { AdsActor } from "../domain/ads.types";
import {
  MAX_SAVED_AUDIENCES,
  parseAudience,
  PlanTargeting,
} from "../domain/audience";
import { AudienceRepository } from "../infrastructure/audience.repository";
import { AdAudienceRow } from "../infrastructure/audiences.tables";

export interface SavedAudienceView {
  id: string;
  name: string;
  targeting: PlanTargeting;
  createdAt: string;
  updatedAt: string;
}

const view = (row: AdAudienceRow): SavedAudienceView => ({
  id: row.id,
  name: row.name,
  targeting: row.targeting as unknown as PlanTargeting,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const taken = () =>
  new CodedError(
    ErrorCode.CONFLICT,
    409,
    "You already have a saved audience with this name. Choose another name.",
  );

@Injectable()
export class AudiencesService {
  constructor(
    private readonly audiences: AudienceRepository,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string): Promise<{ data: SavedAudienceView[] }> {
    return { data: (await this.audiences.list(workspaceId)).map(view) };
  }

  async get(workspaceId: string, id: string): Promise<SavedAudienceView> {
    const row = await this.audiences.find(workspaceId, id);
    if (!row) throw new NotFoundError("This saved audience doesn't exist.");
    return view(row);
  }

  async create(actor: AdsActor, input: unknown): Promise<SavedAudienceView> {
    const audience = this.parse(input);
    if ((await this.audiences.count(actor.workspaceId)) >= MAX_SAVED_AUDIENCES)
      throw new ValidationError(
        `You can save up to ${MAX_SAVED_AUDIENCES} audiences. Delete one you no longer use first.`,
      );
    if (await this.audiences.nameTaken(actor.workspaceId, audience.name))
      throw taken();
    const row = await this.audiences.insert({
      workspaceId: actor.workspaceId,
      createdBy: actor.userId,
      name: audience.name,
      targeting: audience.targeting as unknown as Record<string, unknown>,
    });
    await this.record(actor, "audience.saved", row.id, { name: row.name });
    return view(row);
  }

  async update(
    actor: AdsActor,
    id: string,
    input: unknown,
  ): Promise<SavedAudienceView> {
    const audience = this.parse(input);
    const row = await this.audiences.find(actor.workspaceId, id);
    if (!row) throw new NotFoundError("This saved audience doesn't exist.");
    if (await this.audiences.nameTaken(actor.workspaceId, audience.name, id))
      throw taken();
    const saved = await this.audiences.update(id, {
      name: audience.name,
      targeting: audience.targeting as unknown as Record<string, unknown>,
    });
    await this.record(actor, "audience.updated", id, { name: saved.name });
    return view(saved);
  }

  async remove(actor: AdsActor, id: string): Promise<void> {
    const row = await this.audiences.find(actor.workspaceId, id);
    if (!row) throw new NotFoundError("This saved audience doesn't exist.");
    await this.audiences.delete(id);
    await this.record(actor, "audience.deleted", id, { name: row.name });
  }

  private parse(input: unknown) {
    const parsed = parseAudience(input);
    if (!parsed.ok)
      throw new ValidationError(`The audience is not valid: ${parsed.message}`);
    return parsed.audience;
  }

  private record(
    actor: AdsActor,
    action: string,
    target: string,
    data: Record<string, unknown>,
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action,
      target,
      data: { ...data, via: actor.via },
    });
  }
}
