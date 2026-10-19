import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import {
  CampaignPlanRow,
  campaignPlans,
  CampaignPlanStatus,
} from "./plans.tables";

@Injectable()
export class PlanRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async insert(
    input: typeof campaignPlans.$inferInsert,
  ): Promise<CampaignPlanRow> {
    const [row] = await this.db.insert(campaignPlans).values(input).returning();
    return row!;
  }

  async find(
    workspaceId: string,
    id: string,
    tx: Executor = this.db,
    lock = false,
  ) {
    const query = tx
      .select()
      .from(campaignPlans)
      .where(
        and(
          eq(campaignPlans.id, id),
          eq(campaignPlans.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    return firstOrNull(lock ? await query.for("update") : await query);
  }

  async list(workspaceId: string, limit: number): Promise<CampaignPlanRow[]> {
    return this.db
      .select()
      .from(campaignPlans)
      .where(eq(campaignPlans.workspaceId, workspaceId))
      .orderBy(desc(campaignPlans.createdAt))
      .limit(limit);
  }

  async countByStatus(
    workspaceId: string,
  ): Promise<Partial<Record<CampaignPlanStatus, number>>> {
    const rows = await this.db
      .select({ status: campaignPlans.status, total: count() })
      .from(campaignPlans)
      .where(eq(campaignPlans.workspaceId, workspaceId))
      .groupBy(campaignPlans.status);
    return Object.fromEntries(rows.map((r) => [r.status, r.total]));
  }

  async update(
    id: string,
    values: Partial<typeof campaignPlans.$inferInsert>,
    tx: Executor = this.db,
  ): Promise<CampaignPlanRow> {
    const [row] = await tx
      .update(campaignPlans)
      .set(values)
      .where(eq(campaignPlans.id, id))
      .returning();
    return row!;
  }
}
