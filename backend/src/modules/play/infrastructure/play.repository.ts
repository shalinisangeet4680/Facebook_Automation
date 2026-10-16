import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import { ACTIVE_REPLY_STATUSES } from "../domain/play.types";
import {
  PlayReplyRow,
  PlayReviewRow,
  playApps,
  playConnections,
  playReplies,
  playReviews,
  playRules,
  playTemplates,
  playWorkspaceSettings,
} from "./play.tables";

@Injectable()
export class PlayRepository {
  constructor(@Inject(DATABASE) readonly db: Database) {}

  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  connections(workspaceId: string) {
    return this.db
      .select()
      .from(playConnections)
      .where(eq(playConnections.workspaceId, workspaceId))
      .orderBy(asc(playConnections.createdAt));
  }

  connectionsDueForDiscovery(before: Date, limit: number) {
    return this.db
      .select()
      .from(playConnections)
      .where(
        or(
          isNull(playConnections.discoveredAt),
          lt(playConnections.discoveredAt, before),
        ),
      )
      .orderBy(asc(playConnections.discoveredAt))
      .limit(limit);
  }

  async connection(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playConnections)
        .where(
          and(
            eq(playConnections.id, id),
            eq(playConnections.workspaceId, workspaceId),
          ),
        )
        .limit(1),
    );
  }

  async connectionById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playConnections)
        .where(eq(playConnections.id, id))
        .limit(1),
    );
  }

  async upsertConnection(values: typeof playConnections.$inferInsert) {
    const [row] = await this.db
      .insert(playConnections)
      .values(values)
      .onConflictDoUpdate({
        target: [playConnections.workspaceId, playConnections.clientEmail],
        set: {
          keyCiphertext: values.keyCiphertext,
          projectId: values.projectId,
          status: "active",
          error: null,
          checkedAt: values.checkedAt,
        },
      })
      .returning();
    return row!;
  }

  async updateConnection(
    id: string,
    values: Partial<typeof playConnections.$inferInsert>,
  ) {
    await this.db
      .update(playConnections)
      .set(values)
      .where(eq(playConnections.id, id));
  }

  async deleteConnection(id: string) {
    await this.db.delete(playConnections).where(eq(playConnections.id, id));
  }

  apps(workspaceId: string) {
    return this.db
      .select()
      .from(playApps)
      .where(
        and(eq(playApps.workspaceId, workspaceId), isNull(playApps.archivedAt)),
      )
      .orderBy(asc(playApps.createdAt));
  }

  allApps(workspaceId: string) {
    return this.db
      .select()
      .from(playApps)
      .where(eq(playApps.workspaceId, workspaceId))
      .orderBy(asc(playApps.createdAt));
  }

  async app(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playApps)
        .where(and(eq(playApps.id, id), eq(playApps.workspaceId, workspaceId)))
        .limit(1),
    );
  }

  async appById(id: string) {
    return firstOrNull(
      await this.db.select().from(playApps).where(eq(playApps.id, id)).limit(1),
    );
  }

  async appByPackage(workspaceId: string, packageName: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playApps)
        .where(
          and(
            eq(playApps.workspaceId, workspaceId),
            eq(playApps.packageName, packageName),
          ),
        )
        .limit(1),
    );
  }

  async insertApp(values: typeof playApps.$inferInsert) {
    const [row] = await this.db.insert(playApps).values(values).returning();
    return row!;
  }

  async updateApp(id: string, values: Partial<typeof playApps.$inferInsert>) {
    const [row] = await this.db
      .update(playApps)
      .set(values)
      .where(eq(playApps.id, id))
      .returning();
    return row!;
  }

  async deleteApp(id: string) {
    await this.db.delete(playApps).where(eq(playApps.id, id));
  }

  appsDueForSync(before: Date, limit: number) {
    return this.db
      .select()
      .from(playApps)
      .where(
        and(
          isNull(playApps.archivedAt),
          or(isNull(playApps.lastSyncedAt), lt(playApps.lastSyncedAt, before)),
        ),
      )
      .orderBy(asc(playApps.lastSyncedAt))
      .limit(limit);
  }

  async setHistoryError(connectionId: string, error: string | null) {
    await this.db
      .update(playApps)
      .set({
        historyError: error,
        historyImportedAt: error ? new Date() : null,
      })
      .where(eq(playApps.connectionId, connectionId));
  }

  async appsDueForHistory(before: Date, retryBefore: Date, limit: number) {
    const rows = await this.db
      .select({ app: playApps })
      .from(playApps)
      .innerJoin(playConnections, eq(playConnections.id, playApps.connectionId))
      .where(
        and(
          isNull(playApps.archivedAt),
          sql`${playConnections.reportsBucket} is not null`,
          or(
            isNull(playApps.historyImportedAt),
            lt(playApps.historyImportedAt, before),
            and(
              sql`${playApps.historyError} is not null`,
              lt(playApps.historyImportedAt, retryBefore),
            ),
          ),
        ),
      )
      .orderBy(asc(playApps.historyImportedAt))
      .limit(limit);
    return rows.map((r) => r.app);
  }

  reviewsByGoogleIds(appId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([] as PlayReviewRow[]);
    return this.db
      .select()
      .from(playReviews)
      .where(
        and(eq(playReviews.appId, appId), inArray(playReviews.reviewId, ids)),
      );
  }

  reviewsSince(appId: string, since: Date) {
    return this.db
      .select()
      .from(playReviews)
      .where(
        and(eq(playReviews.appId, appId), gte(playReviews.reviewedAt, since)),
      )
      .orderBy(asc(playReviews.reviewedAt))
      .limit(50_000);
  }

  async insertReviews(values: (typeof playReviews.$inferInsert)[]) {
    if (!values.length) return 0;
    let inserted = 0;
    for (let i = 0; i < values.length; i += 500) {
      const rows = await this.db
        .insert(playReviews)
        .values(values.slice(i, i + 500))
        .onConflictDoNothing({
          target: [playReviews.appId, playReviews.reviewId],
        })
        .returning({ id: playReviews.id });
      inserted += rows.length;
    }
    return inserted;
  }

  async insertReview(tx: Executor, values: typeof playReviews.$inferInsert) {
    const [row] = await tx.insert(playReviews).values(values).returning();
    return row!;
  }

  async updateReview(
    id: string,
    values: Partial<typeof playReviews.$inferInsert>,
    tx: Executor = this.db,
  ) {
    const [row] = await tx
      .update(playReviews)
      .set(values)
      .where(eq(playReviews.id, id))
      .returning();
    return row!;
  }

  async review(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playReviews)
        .where(
          and(eq(playReviews.id, id), eq(playReviews.workspaceId, workspaceId)),
        )
        .limit(1),
    );
  }

  async reviewById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playReviews)
        .where(eq(playReviews.id, id))
        .limit(1),
    );
  }

  recentReviews(
    appId: string,
    filters: {
      stars?: number[];
      language?: string;
      version?: string;
      q?: string;
    },
    limit: number,
  ) {
    const where = [
      eq(playReviews.appId, appId),
      sql`${playReviews.text} <> ''`,
    ];
    if (filters.stars?.length)
      where.push(inArray(playReviews.stars, filters.stars));
    if (filters.language)
      where.push(
        sql`split_part(lower(${playReviews.language}), '-', 1) = ${filters.language.toLowerCase().split(/[-_]/)[0]}`,
      );
    if (filters.version)
      where.push(eq(playReviews.appVersionName, filters.version));
    if (filters.q)
      where.push(
        sql`(${playReviews.text} ilike ${`%${filters.q}%`} or coalesce(${playReviews.originalText}, '') ilike ${`%${filters.q}%`} or ${playReviews.authorName} ilike ${`%${filters.q}%`})`,
      );
    return this.db
      .select()
      .from(playReviews)
      .where(and(...where))
      .orderBy(desc(playReviews.reviewedAt))
      .limit(limit);
  }

  repliesFor(reviewIds: string[]) {
    if (!reviewIds.length) return Promise.resolve([] as PlayReplyRow[]);
    return this.db
      .select()
      .from(playReplies)
      .where(inArray(playReplies.reviewId, reviewIds))
      .orderBy(desc(playReplies.createdAt));
  }

  async activeReply(reviewId: string, tx: Executor = this.db) {
    return firstOrNull(
      await tx
        .select()
        .from(playReplies)
        .where(
          and(
            eq(playReplies.reviewId, reviewId),
            inArray(playReplies.status, ACTIVE_REPLY_STATUSES),
          ),
        )
        .limit(1),
    );
  }

  async reply(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playReplies)
        .where(
          and(eq(playReplies.id, id), eq(playReplies.workspaceId, workspaceId)),
        )
        .limit(1),
    );
  }

  async insertReply(
    values: typeof playReplies.$inferInsert,
    tx: Executor = this.db,
  ) {
    const [row] = await tx.insert(playReplies).values(values).returning();
    return row!;
  }

  async updateReply(
    id: string,
    values: Partial<typeof playReplies.$inferInsert>,
    tx: Executor = this.db,
  ) {
    const [row] = await tx
      .update(playReplies)
      .set(values)
      .where(eq(playReplies.id, id))
      .returning();
    return row!;
  }

  dueReplies(now: Date, limit: number) {
    return this.db
      .select()
      .from(playReplies)
      .where(
        and(eq(playReplies.status, "scheduled"), lte(playReplies.sendAt, now)),
      )
      .orderBy(asc(playReplies.sendAt))
      .limit(limit);
  }

  async autoRepliesSince(appId: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(playReplies)
      .where(
        and(
          eq(playReplies.appId, appId),
          eq(playReplies.auto, true),
          inArray(playReplies.status, ["scheduled", "sent"]),
          gte(playReplies.createdAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  async appStats(appId: string, now: Date) {
    const day = 86_400_000;
    const since = new Date(now.getTime() - 30 * day);
    const before = new Date(now.getTime() - 60 * day);
    const [current] = await this.db
      .select({ rating: avg(playReviews.stars), n: count() })
      .from(playReviews)
      .where(
        and(eq(playReviews.appId, appId), gte(playReviews.reviewedAt, since)),
      );
    const [previous] = await this.db
      .select({ rating: avg(playReviews.stars) })
      .from(playReviews)
      .where(
        and(
          eq(playReviews.appId, appId),
          gte(playReviews.reviewedAt, before),
          lt(playReviews.reviewedAt, since),
        ),
      );
    const [open] = await this.db
      .select({ n: count() })
      .from(playReviews)
      .where(
        and(
          eq(playReviews.appId, appId),
          sql`${playReviews.text} <> ''`,
          isNull(playReviews.skippedAt),
          or(
            isNull(playReviews.replyText),
            eq(playReviews.editedAfterReply, true),
          ),
        ),
      );
    const [overall] = await this.db
      .select({ rating: avg(playReviews.stars) })
      .from(playReviews)
      .where(eq(playReviews.appId, appId));
    const [failed] = await this.db
      .select({ n: count() })
      .from(playReplies)
      .innerJoin(playReviews, eq(playReviews.id, playReplies.reviewId))
      .where(
        and(
          eq(playReplies.appId, appId),
          eq(playReplies.status, "failed"),
          isNull(playReviews.replyText),
          isNull(playReviews.skippedAt),
        ),
      );
    const waiting = await this.db
      .select({ status: playReplies.status, n: count() })
      .from(playReplies)
      .where(
        and(
          eq(playReplies.appId, appId),
          inArray(playReplies.status, ACTIVE_REPLY_STATUSES),
        ),
      )
      .groupBy(playReplies.status);
    return {
      rating: current?.rating ? Number(current.rating) : null,
      previousRating: previous?.rating ? Number(previous.rating) : null,
      overall: overall?.rating ? Number(overall.rating) : null,
      failed: failed?.n ?? 0,
      reviews30d: current?.n ?? 0,
      needsReply: open?.n ?? 0,
      waiting: Object.fromEntries(
        waiting.map((w) => [w.status, w.n]),
      ) as Record<string, number>,
    };
  }

  templates(workspaceId: string, appId?: string) {
    return this.db
      .select()
      .from(playTemplates)
      .where(
        and(
          eq(playTemplates.workspaceId, workspaceId),
          appId
            ? or(isNull(playTemplates.appId), eq(playTemplates.appId, appId))
            : isNull(playTemplates.appId),
        ),
      )
      .orderBy(asc(playTemplates.createdAt));
  }

  allTemplates(workspaceId: string) {
    return this.db
      .select()
      .from(playTemplates)
      .where(eq(playTemplates.workspaceId, workspaceId))
      .orderBy(asc(playTemplates.createdAt));
  }

  async template(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playTemplates)
        .where(
          and(
            eq(playTemplates.id, id),
            eq(playTemplates.workspaceId, workspaceId),
          ),
        )
        .limit(1),
    );
  }

  async insertTemplates(values: (typeof playTemplates.$inferInsert)[]) {
    if (!values.length) return [];
    return this.db
      .insert(playTemplates)
      .values(values)
      .onConflictDoNothing()
      .returning();
  }

  async updateTemplate(
    id: string,
    values: Partial<typeof playTemplates.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(playTemplates)
      .set(values)
      .where(eq(playTemplates.id, id))
      .returning();
    return row!;
  }

  async deleteTemplate(id: string) {
    await this.db.delete(playTemplates).where(eq(playTemplates.id, id));
  }

  rules(appId: string) {
    return this.db
      .select()
      .from(playRules)
      .where(eq(playRules.appId, appId))
      .orderBy(asc(playRules.position));
  }

  rulesUsingTemplate(templateId: string) {
    return this.db
      .select({
        id: playRules.id,
        name: playRules.name,
        appId: playRules.appId,
      })
      .from(playRules)
      .where(sql`${playRules.action}->>'templateId' = ${templateId}`);
  }

  async replaceRules(appId: string, rows: (typeof playRules.$inferInsert)[]) {
    return this.db.transaction(async (tx) => {
      await tx.delete(playRules).where(eq(playRules.appId, appId));
      if (!rows.length) return [];
      return tx.insert(playRules).values(rows).returning();
    });
  }

  async workspaceSettings(workspaceId: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(playWorkspaceSettings)
        .where(eq(playWorkspaceSettings.workspaceId, workspaceId))
        .limit(1),
    );
  }

  async saveWorkspaceSettings(
    workspaceId: string,
    values: Partial<typeof playWorkspaceSettings.$inferInsert>,
  ) {
    const [row] = await this.db
      .insert(playWorkspaceSettings)
      .values({ ...values, workspaceId })
      .onConflictDoUpdate({
        target: playWorkspaceSettings.workspaceId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  async settingsByToken(hash: string, now: Date) {
    return firstOrNull(
      await this.db
        .select()
        .from(playWorkspaceSettings)
        .where(
          or(
            eq(playWorkspaceSettings.tokenHash, hash),
            and(
              eq(playWorkspaceSettings.previousTokenHash, hash),
              gte(playWorkspaceSettings.previousTokenExpiresAt, now),
            ),
          ),
        )
        .limit(1),
    );
  }

  repliedSince(appId: string, since: Date) {
    return this.db
      .select({
        repliedAt: playReviews.repliedAt,
        replyText: playReviews.replyText,
      })
      .from(playReviews)
      .where(
        and(eq(playReviews.appId, appId), gte(playReviews.repliedAt, since)),
      );
  }

  async replyTexts(appId: string, limit: number) {
    const rows = await this.db
      .select({ text: playReviews.replyText })
      .from(playReviews)
      .where(
        and(
          eq(playReviews.appId, appId),
          sql`${playReviews.replyText} is not null`,
        ),
      )
      .orderBy(desc(playReviews.repliedAt))
      .limit(limit);
    return rows.map((r) => r.text!);
  }

  untaggedReviews(appId: string, limit: number) {
    return this.db
      .select()
      .from(playReviews)
      .where(and(eq(playReviews.appId, appId), isNull(playReviews.topic)))
      .limit(limit);
  }

  async aiDraftsSince(workspaceId: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(playReplies)
      .where(
        and(
          eq(playReplies.workspaceId, workspaceId),
          eq(playReplies.source, "ai"),
          gte(playReplies.updatedAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  async holdScheduled(appId: string, note: string) {
    await this.db
      .update(playReplies)
      .set({ status: "pending_approval", auto: false, sendAt: null, note })
      .where(
        and(
          eq(playReplies.appId, appId),
          eq(playReplies.status, "scheduled"),
          eq(playReplies.auto, true),
        ),
      );
  }

  async firstReviewAt(workspaceId: string, appIds: string[]) {
    if (!appIds.length) return null;
    const [row] = await this.db
      .select({ first: sql<Date | null>`min(${playReviews.reviewedAt})` })
      .from(playReviews)
      .where(
        and(
          eq(playReviews.workspaceId, workspaceId),
          inArray(playReviews.appId, appIds),
        ),
      );
    return row?.first ? new Date(row.first) : null;
  }

  workspaceReviews(
    workspaceId: string,
    filters: { appIds: string[]; since?: Date },
    limit: number,
  ) {
    if (!filters.appIds.length) return Promise.resolve([] as PlayReviewRow[]);
    const where = [
      eq(playReviews.workspaceId, workspaceId),
      inArray(playReviews.appId, filters.appIds),
    ];
    if (filters.since) where.push(gte(playReviews.reviewedAt, filters.since));
    return this.db
      .select()
      .from(playReviews)
      .where(and(...where))
      .orderBy(desc(playReviews.reviewedAt))
      .limit(limit);
  }

  openReviews(
    workspaceId: string,
    appIds: string[],
    limit: number,
    stars?: number[],
  ) {
    if (!appIds.length) return Promise.resolve([] as PlayReviewRow[]);
    return this.db
      .select()
      .from(playReviews)
      .where(
        and(
          eq(playReviews.workspaceId, workspaceId),
          inArray(playReviews.appId, appIds),
          stars?.length ? inArray(playReviews.stars, stars) : undefined,
          isNull(playReviews.skippedAt),
          or(
            isNull(playReviews.replyText),
            eq(playReviews.editedAfterReply, true),
          ),
          sql`(${playReviews.text} <> '' or exists (select 1 from ${playReplies} where ${playReplies.reviewId} = ${playReviews.id} and ${playReplies.status} in ('pending_approval', 'needs_claude', 'scheduled', 'failed')))`,
        ),
      )
      .orderBy(desc(playReviews.reviewedAt))
      .limit(limit);
  }

  doneReviews(
    workspaceId: string,
    appIds: string[],
    limit: number,
    stars?: number[],
  ) {
    if (!appIds.length) return Promise.resolve([] as PlayReviewRow[]);
    return this.db
      .select()
      .from(playReviews)
      .where(
        and(
          eq(playReviews.workspaceId, workspaceId),
          inArray(playReviews.appId, appIds),
          stars?.length ? inArray(playReviews.stars, stars) : undefined,
          or(
            sql`${playReviews.skippedAt} is not null`,
            and(
              sql`${playReviews.replyText} is not null`,
              eq(playReviews.editedAfterReply, false),
            ),
          ),
        ),
      )
      .orderBy(
        desc(
          sql`coalesce(${playReviews.repliedAt}, ${playReviews.skippedAt}, ${playReviews.reviewedAt})`,
        ),
      )
      .limit(limit);
  }

  async sentRepliesBetween(
    workspaceId: string,
    appIds: string[],
    from: Date,
    to: Date,
  ) {
    if (!appIds.length) return 0;
    const [row] = await this.db
      .select({ n: count() })
      .from(playReplies)
      .where(
        and(
          eq(playReplies.workspaceId, workspaceId),
          inArray(playReplies.appId, appIds),
          eq(playReplies.status, "sent"),
          gte(playReplies.sentAt, from),
          lte(playReplies.sentAt, to),
        ),
      );
    return row?.n ?? 0;
  }
}
