import { Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
import { todayIn } from "@modules/reports/domain/periods";
import { NotFoundError } from "@shared/errors/domain-error";

import { toCsv } from "../domain/csv";
import { contactOf, FormQuestion } from "../domain/lead-fields";
import { LeadFilters, LeadSyncView, LeadView } from "../domain/lead.types";
import {
  decodeLeadCursor,
  encodeLeadCursor,
  LeadsRepository,
} from "../infrastructure/leads.repository";
import {
  LeadStatus,
  MetaLeadFormRow,
  MetaLeadRow,
} from "../infrastructure/leads.tables";
import { LeadSyncService } from "./lead-sync.service";

export interface LeadsActor {
  userId: string;
  workspaceId: string;
  via: string;
}

export interface LeadUpdate {
  status?: LeadStatus;
  notes?: string | null;
}

const EXPORT_LIMIT = 10_000;
const TIMEZONE = "Asia/Kolkata";

@Injectable()
export class LeadsService {
  constructor(
    private readonly repo: LeadsRepository,
    private readonly sync: LeadSyncService,
    private readonly audit: AuditService,
  ) {}

  async list(
    workspaceId: string,
    filters: LeadFilters,
    limit: number,
    cursor?: string,
  ): Promise<{ data: LeadView[]; nextCursor: string | null }> {
    const [rows, forms] = await Promise.all([
      this.repo.list(workspaceId, filters, limit, decodeLeadCursor(cursor)),
      this.formsById(workspaceId),
    ]);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map((r) => toView(r, forms.get(r.formId))),
      nextCursor: hasMore ? encodeLeadCursor(page[page.length - 1]!) : null,
    };
  }

  async get(workspaceId: string, id: string): Promise<LeadView> {
    const row = await this.repo.find(workspaceId, id);
    if (!row) throw new NotFoundError("This lead doesn't exist.");
    const forms = await this.formsById(workspaceId);
    return toView(row, forms.get(row.formId));
  }

  async update(
    actor: LeadsActor,
    id: string,
    input: LeadUpdate,
  ): Promise<LeadView> {
    const before = await this.repo.find(actor.workspaceId, id);
    if (!before) throw new NotFoundError("This lead doesn't exist.");
    const values: LeadUpdate = {};
    if (input.status !== undefined) values.status = input.status;
    if (input.notes !== undefined) values.notes = input.notes?.trim() || null;
    const row = Object.keys(values).length
      ? await this.repo.update(actor.workspaceId, id, values)
      : before;
    if (!row) throw new NotFoundError("This lead doesn't exist.");
    const fields = Object.keys(values);
    if (fields.length)
      await this.audit.record({
        workspaceId: actor.workspaceId,
        actor: "user",
        actorId: actor.userId,
        action: "lead.updated",
        target: id,
        data: {
          fields,
          ...(values.status !== undefined
            ? { from: before.status, to: row.status }
            : {}),
          via: actor.via,
        },
      });
    const forms = await this.formsById(actor.workspaceId);
    return toView(row, forms.get(row.formId));
  }

  async summary(workspaceId: string): Promise<{
    total: number;
    new: number;
    today: number;
    campaigns: { id: string; name: string | null }[];
    sync: LeadSyncView;
  }> {
    const since = new Date(`${todayIn(TIMEZONE)}T00:00:00+05:30`);
    const [counts, campaigns, sync] = await Promise.all([
      this.repo.counts(workspaceId, since),
      this.repo.campaigns(workspaceId),
      this.sync.view(workspaceId),
    ]);
    return { ...counts, campaigns, sync };
  }

  async exportCsv(
    actor: LeadsActor,
    filters: LeadFilters,
  ): Promise<{ filename: string; body: string; count: number }> {
    const [rows, forms] = await Promise.all([
      this.repo.exportRows(actor.workspaceId, filters, EXPORT_LIMIT),
      this.formsById(actor.workspaceId),
    ]);
    const views = rows.map((r) => toView(r, forms.get(r.formId)));
    const body = toCsv(
      [
        "Created",
        "Name",
        "Phone",
        "Email",
        "City",
        "Other answers",
        "Status",
        "Notes",
        "Campaign",
        "Ad set",
        "Ad",
        "Form",
        "Lead ID",
      ],
      views.map((v) => [
        v.createdTime,
        v.name,
        v.phone,
        v.email,
        v.city,
        v.answers.map((a) => `${a.label}: ${a.value}`).join("; "),
        v.status,
        v.notes,
        v.campaign?.name ?? v.campaign?.id ?? null,
        v.adSet?.name ?? v.adSet?.id ?? null,
        v.ad?.name ?? v.ad?.id ?? null,
        v.form.name ?? v.form.id,
        v.leadId,
      ]),
    );
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action: "lead.exported",
      data: {
        count: views.length,
        status: filters.status ?? null,
        campaignId: filters.campaignId ?? null,
        searched: Boolean(filters.q?.trim()),
        via: actor.via,
      },
    });
    return {
      filename: `leads-${todayIn(TIMEZONE)}.csv`,
      body: `﻿${body}`,
      count: views.length,
    };
  }

  private async formsById(
    workspaceId: string,
  ): Promise<Map<string, MetaLeadFormRow>> {
    return new Map(
      (await this.repo.forms(workspaceId)).map((f) => [f.formId, f]),
    );
  }
}

function named(id: string | null, name: string | null) {
  return id ? { id, name } : null;
}

export function toView(row: MetaLeadRow, form?: MetaLeadFormRow): LeadView {
  const questions: FormQuestion[] = form?.questions ?? [];
  const contact = contactOf(row.fieldData, questions);
  return {
    id: row.id,
    leadId: row.leadId,
    createdTime: row.createdTime.toISOString(),
    status: row.status,
    notes: row.notes,
    ...contact,
    form: { id: row.formId, name: form?.name ?? null },
    campaign: named(row.campaignId, row.campaignName),
    adSet: named(row.adSetId, row.adSetName),
    ad: named(row.adId, row.adName),
  };
}
