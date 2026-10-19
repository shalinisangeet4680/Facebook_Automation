import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ne } from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";

import { AdAudienceRow, adAudiences } from "./audiences.tables";

@Injectable()
export class AudienceRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(workspaceId: string): Promise<AdAudienceRow[]> {
    return this.db
      .select()
      .from(adAudiences)
      .where(eq(adAudiences.workspaceId, workspaceId))
      .orderBy(desc(adAudiences.updatedAt));
  }

  async find(workspaceId: string, id: string): Promise<AdAudienceRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(adAudiences)
        .where(
          and(eq(adAudiences.id, id), eq(adAudiences.workspaceId, workspaceId)),
        )
        .limit(1),
    );
  }

  async nameTaken(
    workspaceId: string,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: adAudiences.id })
      .from(adAudiences)
      .where(
        and(
          eq(adAudiences.workspaceId, workspaceId),
          eq(adAudiences.name, name),
          ...(exceptId ? [ne(adAudiences.id, exceptId)] : []),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async count(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(adAudiences)
      .where(eq(adAudiences.workspaceId, workspaceId));
    return row?.total ?? 0;
  }

  async insert(
    values: typeof adAudiences.$inferInsert,
  ): Promise<AdAudienceRow> {
    const [row] = await this.db.insert(adAudiences).values(values).returning();
    return row!;
  }

  async update(
    id: string,
    values: Partial<typeof adAudiences.$inferInsert>,
  ): Promise<AdAudienceRow> {
    const [row] = await this.db
      .update(adAudiences)
      .set(values)
      .where(eq(adAudiences.id, id))
      .returning();
    return row!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(adAudiences).where(eq(adAudiences.id, id));
  }
}
