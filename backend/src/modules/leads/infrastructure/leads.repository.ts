import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  or,
  SQL,
  sql,
} from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { ValidationError } from "@shared/errors/domain-error";

import { LeadFilters } from "../domain/lead.types";
import {
  MetaLeadFormRow,
  MetaLeadRow,
  metaLeadForms,
  metaLeads,
  metaLeadSyncs,
  MetaLeadSyncRow,
} from "./leads.tables";

export function encodeLeadCursor(row: MetaLeadRow): string {
  return Buffer.from(
    JSON.stringify({ t: row.createdTime.toISOString(), id: row.id }),
  ).toString("base64url");
}

export function decodeLeadCursor(
  cursor: string | undefined,
): { t: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { t?: unknown; id?: unknown };
    const t = typeof parsed.t === "string" ? new Date(parsed.t) : null;
    if (
      t &&
      !Number.isNaN(t.getTime()) &&
      typeof parsed.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(parsed.id)
    )
      return { t, id: parsed.id };
  } catch {
    throw new ValidationError("The page cursor is invalid.");
  }
  throw new ValidationError("The page cursor is invalid.");
}

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

@Injectable()
export class LeadsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  forms(workspaceId: string): Promise<MetaLeadFormRow[]> {
    return this.db
      .select()
      .from(metaLeadForms)
      .where(eq(metaLeadForms.workspaceId, workspaceId))
      .orderBy(metaLeadForms.createdAt);
  }

  async upsertForm(
    values: typeof metaLeadForms.$inferInsert,
  ): Promise<MetaLeadFormRow> {
    const [row] = await this.db
      .insert(metaLeadForms)
      .values(values)
      .onConflictDoUpdate({
        target: [metaLeadForms.workspaceId, metaLeadForms.formId],
        set: {
          name: values.name,
          pageId: values.pageId,
          status: values.status ?? "ACTIVE",
          ...(values.questions?.length ? { questions: values.questions } : {}),
          ...(values.source === "created"
            ? { source: "created" as const, planId: values.planId ?? null }
            : {}),
        },
      })
      .returning();
    return row!;
  }

  async updateForm(
    id: string,
    values: Partial<typeof metaLeadForms.$inferInsert>,
  ): Promise<void> {
    await this.db
      .update(metaLeadForms)
      .set(values)
      .where(eq(metaLeadForms.id, id));
  }

  async workspacesWithForms(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ workspaceId: metaLeadForms.workspaceId })
      .from(metaLeadForms);
    return rows.map((r) => r.workspaceId);
  }

  async insertLeads(
    rows: (typeof metaLeads.$inferInsert)[],
  ): Promise<MetaLeadRow[]> {
    if (!rows.length) return [];
    return this.db
      .insert(metaLeads)
      .values(rows)
      .onConflictDoNothing({
        target: [metaLeads.workspaceId, metaLeads.leadId],
      })
      .returning();
  }

  private where(workspaceId: string, filters: LeadFilters): SQL {
    const parts: (SQL | undefined)[] = [eq(metaLeads.workspaceId, workspaceId)];
    if (filters.status) parts.push(eq(metaLeads.status, filters.status));
    if (filters.campaignId)
      parts.push(eq(metaLeads.campaignId, filters.campaignId));
    const q = filters.q?.trim();
    if (q) {
      const pattern = likePattern(q);
      parts.push(
        or(
          sql`jsonb_path_query_array(${metaLeads.fieldData}, '$[*].values[*]')::text ilike ${pattern}`,
          sql`${metaLeads.campaignName} ilike ${pattern}`,
          sql`${metaLeads.notes} ilike ${pattern}`,
        ),
      );
    }
    return and(...parts)!;
  }

  list(
    workspaceId: string,
    filters: LeadFilters,
    limit: number,
    cursor: { t: Date; id: string } | null,
  ): Promise<MetaLeadRow[]> {
    const after = cursor
      ? or(
          lt(metaLeads.createdTime, cursor.t),
          and(eq(metaLeads.createdTime, cursor.t), lt(metaLeads.id, cursor.id)),
        )
      : undefined;
    return this.db
      .select()
      .from(metaLeads)
      .where(and(this.where(workspaceId, filters), after))
      .orderBy(desc(metaLeads.createdTime), desc(metaLeads.id))
      .limit(limit + 1);
  }

  exportRows(
    workspaceId: string,
    filters: LeadFilters,
    max: number,
  ): Promise<MetaLeadRow[]> {
    return this.db
      .select()
      .from(metaLeads)
      .where(this.where(workspaceId, filters))
      .orderBy(desc(metaLeads.createdTime), desc(metaLeads.id))
      .limit(max);
  }

  async find(workspaceId: string, id: string): Promise<MetaLeadRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(metaLeads)
        .where(
          and(eq(metaLeads.id, id), eq(metaLeads.workspaceId, workspaceId)),
        )
        .limit(1),
    );
  }

  async update(
    workspaceId: string,
    id: string,
    values: Partial<Pick<MetaLeadRow, "status" | "notes">>,
  ): Promise<MetaLeadRow | null> {
    return firstOrNull(
      await this.db
        .update(metaLeads)
        .set(values)
        .where(
          and(eq(metaLeads.id, id), eq(metaLeads.workspaceId, workspaceId)),
        )
        .returning(),
    );
  }

  async counts(
    workspaceId: string,
    since: Date,
  ): Promise<{ total: number; new: number; today: number }> {
    const [row] = await this.db
      .select({
        total: count(),
        new: sql<number>`count(*) filter (where ${metaLeads.status} = 'new')`.mapWith(
          Number,
        ),
        today:
          sql<number>`count(*) filter (where ${gte(metaLeads.createdTime, since)})`.mapWith(
            Number,
          ),
      })
      .from(metaLeads)
      .where(eq(metaLeads.workspaceId, workspaceId));
    return {
      total: row?.total ?? 0,
      new: row?.new ?? 0,
      today: row?.today ?? 0,
    };
  }

  async campaigns(
    workspaceId: string,
  ): Promise<{ id: string; name: string | null }[]> {
    const rows = await this.db
      .select({
        id: metaLeads.campaignId,
        name: sql<string | null>`max(${metaLeads.campaignName})`,
      })
      .from(metaLeads)
      .where(
        and(
          eq(metaLeads.workspaceId, workspaceId),
          isNotNull(metaLeads.campaignId),
        ),
      )
      .groupBy(metaLeads.campaignId)
      .orderBy(sql`max(${metaLeads.createdTime}) desc`)
      .limit(100);
    return rows.map((r) => ({ id: r.id!, name: r.name }));
  }

  async syncState(workspaceId: string): Promise<MetaLeadSyncRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(metaLeadSyncs)
        .where(eq(metaLeadSyncs.workspaceId, workspaceId))
        .limit(1),
    );
  }

  async saveSync(
    workspaceId: string,
    values: Partial<typeof metaLeadSyncs.$inferInsert>,
  ): Promise<void> {
    await this.db
      .insert(metaLeadSyncs)
      .values({ ...values, workspaceId })
      .onConflictDoUpdate({ target: metaLeadSyncs.workspaceId, set: values });
  }
}
