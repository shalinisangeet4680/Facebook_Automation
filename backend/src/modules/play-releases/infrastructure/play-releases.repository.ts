import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { playApps } from "@modules/play/infrastructure/play.tables";

import {
  playReleaseEvents,
  playReleaseGuardians,
} from "./play-releases.tables";

@Injectable()
export class PlayReleasesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async guardian(appId: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playReleaseGuardians)
        .where(eq(playReleaseGuardians.appId, appId))
        .limit(1),
    );
  }

  async saveGuardian(
    values: typeof playReleaseGuardians.$inferInsert,
  ): Promise<typeof playReleaseGuardians.$inferSelect> {
    const { appId: _appId, workspaceId: _ws, ...update } = values;
    const [row] = await this.db
      .insert(playReleaseGuardians)
      .values(values)
      .onConflictDoUpdate({ target: playReleaseGuardians.appId, set: update })
      .returning();
    return row!;
  }

  async updateGuardian(
    appId: string,
    values: Partial<typeof playReleaseGuardians.$inferInsert>,
  ) {
    await this.db
      .update(playReleaseGuardians)
      .set(values)
      .where(eq(playReleaseGuardians.appId, appId));
  }

  guardiansDue(before: Date, limit: number) {
    return this.db
      .select({ guardian: playReleaseGuardians, app: playApps })
      .from(playReleaseGuardians)
      .innerJoin(playApps, eq(playApps.id, playReleaseGuardians.appId))
      .where(
        and(
          eq(playReleaseGuardians.enabled, true),
          isNull(playApps.archivedAt),
          or(
            isNull(playReleaseGuardians.lastCheckedAt),
            lt(playReleaseGuardians.lastCheckedAt, before),
          ),
        ),
      )
      .orderBy(asc(playReleaseGuardians.lastCheckedAt))
      .limit(limit);
  }

  async addEvent(values: typeof playReleaseEvents.$inferInsert) {
    const [row] = await this.db
      .insert(playReleaseEvents)
      .values(values)
      .returning();
    return row!;
  }

  events(appId: string, limit: number) {
    return this.db
      .select()
      .from(playReleaseEvents)
      .where(eq(playReleaseEvents.appId, appId))
      .orderBy(desc(playReleaseEvents.createdAt))
      .limit(limit);
  }
}
