import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
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

import { DailyMetrics } from "../domain/business.types";
import {
  GbpReviewRow,
  gbpConnections,
  gbpLocations,
  gbpMetrics,
  gbpPosts,
  gbpReplies,
  gbpReviews,
  gbpTemplates,
} from "./business.tables";

const ACTIVE = sql`status in ('pending_approval', 'needs_claude', 'scheduled')`;

@Injectable()
export class BusinessRepository {
  constructor(@Inject(DATABASE) readonly db: Database) {}

  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  connections(workspaceId: string) {
    return this.db
      .select()
      .from(gbpConnections)
      .where(eq(gbpConnections.workspaceId, workspaceId))
      .orderBy(asc(gbpConnections.createdAt));
  }

  async connection(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpConnections)
        .where(
          and(
            eq(gbpConnections.workspaceId, workspaceId),
            eq(gbpConnections.id, id),
          ),
        )
        .limit(1),
    );
  }

  async connectionById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpConnections)
        .where(eq(gbpConnections.id, id))
        .limit(1),
    );
  }

  connectionsDueForDiscovery(before: Date, limit: number) {
    return this.db
      .select()
      .from(gbpConnections)
      .where(
        and(
          eq(gbpConnections.status, "active"),
          or(
            isNull(gbpConnections.discoveredAt),
            lt(gbpConnections.discoveredAt, before),
          ),
        ),
      )
      .limit(limit);
  }

  async upsertConnection(values: typeof gbpConnections.$inferInsert) {
    const [row] = await this.db
      .insert(gbpConnections)
      .values(values)
      .onConflictDoUpdate({
        target: [gbpConnections.workspaceId, gbpConnections.email],
        set: {
          refreshTokenCiphertext: values.refreshTokenCiphertext,
          status: "active",
          error: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  async updateConnection(
    id: string,
    values: Partial<typeof gbpConnections.$inferInsert>,
  ) {
    await this.db
      .update(gbpConnections)
      .set(values)
      .where(eq(gbpConnections.id, id));
  }

  async deleteConnection(id: string) {
    await this.db.delete(gbpConnections).where(eq(gbpConnections.id, id));
  }

  locations(workspaceId: string) {
    return this.db
      .select()
      .from(gbpLocations)
      .where(
        and(
          eq(gbpLocations.workspaceId, workspaceId),
          isNull(gbpLocations.archivedAt),
        ),
      )
      .orderBy(asc(gbpLocations.createdAt));
  }

  allLocations(workspaceId: string) {
    return this.db
      .select()
      .from(gbpLocations)
      .where(eq(gbpLocations.workspaceId, workspaceId))
      .orderBy(asc(gbpLocations.createdAt));
  }

  async location(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpLocations)
        .where(
          and(
            eq(gbpLocations.workspaceId, workspaceId),
            eq(gbpLocations.id, id),
            isNull(gbpLocations.archivedAt),
          ),
        )
        .limit(1),
    );
  }

  async locationById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpLocations)
        .where(eq(gbpLocations.id, id))
        .limit(1),
    );
  }

  async locationByName(workspaceId: string, locationName: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpLocations)
        .where(
          and(
            eq(gbpLocations.workspaceId, workspaceId),
            eq(gbpLocations.locationName, locationName),
          ),
        )
        .limit(1),
    );
  }

  async insertLocation(values: typeof gbpLocations.$inferInsert) {
    const [row] = await this.db.insert(gbpLocations).values(values).returning();
    return row!;
  }

  async updateLocation(
    id: string,
    values: Partial<typeof gbpLocations.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(gbpLocations)
      .set(values)
      .where(eq(gbpLocations.id, id))
      .returning();
    return row!;
  }

  async deleteLocation(id: string) {
    await this.db.delete(gbpLocations).where(eq(gbpLocations.id, id));
  }

  locationsDueForSync(before: Date, limit: number) {
    return this.db
      .select()
      .from(gbpLocations)
      .innerJoin(
        gbpConnections,
        eq(gbpConnections.id, gbpLocations.connectionId),
      )
      .where(
        and(
          isNull(gbpLocations.archivedAt),
          eq(gbpConnections.status, "active"),
          or(
            isNull(gbpLocations.lastSyncedAt),
            lt(gbpLocations.lastSyncedAt, before),
          ),
        ),
      )
      .orderBy(asc(gbpLocations.lastSyncedAt))
      .limit(limit)
      .then((rows) => rows.map((r) => r.gbp_locations));
  }

  locationsDueForMetrics(before: Date, limit: number) {
    return this.db
      .select()
      .from(gbpLocations)
      .where(
        and(
          isNull(gbpLocations.archivedAt),
          isNotNull(gbpLocations.firstSyncedAt),
          or(
            isNull(gbpLocations.metricsSyncedAt),
            lt(gbpLocations.metricsSyncedAt, before),
          ),
        ),
      )
      .limit(limit);
  }

  reviewsByGoogleIds(locationId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([] as GbpReviewRow[]);
    return this.db
      .select()
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.locationId, locationId),
          inArray(gbpReviews.reviewId, ids),
        ),
      );
  }

  async insertReview(
    values: typeof gbpReviews.$inferInsert,
    tx: Executor = this.db,
  ) {
    const [row] = await tx.insert(gbpReviews).values(values).returning();
    return row!;
  }

  async updateReview(
    id: string,
    values: Partial<typeof gbpReviews.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(gbpReviews)
      .set(values)
      .where(eq(gbpReviews.id, id))
      .returning();
    return row!;
  }

  async review(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpReviews)
        .where(
          and(eq(gbpReviews.workspaceId, workspaceId), eq(gbpReviews.id, id)),
        )
        .limit(1),
    );
  }

  async reviewById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpReviews)
        .where(eq(gbpReviews.id, id))
        .limit(1),
    );
  }

  locationReviews(
    locationId: string,
    stars: number[] | undefined,
    limit: number,
  ) {
    return this.db
      .select()
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.locationId, locationId),
          stars?.length ? inArray(gbpReviews.stars, stars) : undefined,
        ),
      )
      .orderBy(desc(gbpReviews.reviewedAt))
      .limit(limit);
  }

  openReviews(
    workspaceId: string,
    locationIds: string[],
    limit: number,
    stars?: number[],
  ) {
    if (!locationIds.length) return Promise.resolve([] as GbpReviewRow[]);
    return this.db
      .select()
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.workspaceId, workspaceId),
          inArray(gbpReviews.locationId, locationIds),
          stars?.length ? inArray(gbpReviews.stars, stars) : undefined,
          isNull(gbpReviews.skippedAt),
          or(
            isNull(gbpReviews.replyText),
            eq(gbpReviews.editedAfterReply, true),
          ),
        ),
      )
      .orderBy(desc(gbpReviews.reviewedAt))
      .limit(limit);
  }

  doneReviews(
    workspaceId: string,
    locationIds: string[],
    limit: number,
    stars?: number[],
  ) {
    if (!locationIds.length) return Promise.resolve([] as GbpReviewRow[]);
    return this.db
      .select()
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.workspaceId, workspaceId),
          inArray(gbpReviews.locationId, locationIds),
          stars?.length ? inArray(gbpReviews.stars, stars) : undefined,
          or(
            isNotNull(gbpReviews.skippedAt),
            and(
              isNotNull(gbpReviews.replyText),
              eq(gbpReviews.editedAfterReply, false),
            ),
          ),
        ),
      )
      .orderBy(
        desc(
          sql`coalesce(${gbpReviews.repliedAt}, ${gbpReviews.skippedAt}, ${gbpReviews.reviewedAt})`,
        ),
      )
      .limit(limit);
  }

  workspaceReviews(
    workspaceId: string,
    locationIds: string[],
    since: Date,
    limit: number,
  ) {
    if (!locationIds.length) return Promise.resolve([]);
    return this.db
      .select({
        stars: gbpReviews.stars,
        text: gbpReviews.text,
        reviewedAt: gbpReviews.reviewedAt,
        repliedAt: gbpReviews.repliedAt,
        replyText: gbpReviews.replyText,
        topic: gbpReviews.topic,
      })
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.workspaceId, workspaceId),
          inArray(gbpReviews.locationId, locationIds),
          gte(gbpReviews.reviewedAt, since),
        ),
      )
      .orderBy(desc(gbpReviews.reviewedAt))
      .limit(limit);
  }

  async firstReviewAt(workspaceId: string, locationIds: string[]) {
    if (!locationIds.length) return null;
    const [row] = await this.db
      .select({ at: sql<Date | null>`min(${gbpReviews.reviewedAt})` })
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.workspaceId, workspaceId),
          inArray(gbpReviews.locationId, locationIds),
        ),
      );
    return row?.at ? new Date(row.at) : null;
  }

  async replyTexts(locationId: string, limit: number) {
    const rows = await this.db
      .select({ text: gbpReviews.replyText })
      .from(gbpReviews)
      .where(
        and(
          eq(gbpReviews.locationId, locationId),
          isNotNull(gbpReviews.replyText),
        ),
      )
      .orderBy(desc(gbpReviews.repliedAt))
      .limit(limit);
    return rows.map((r) => r.text!).filter(Boolean);
  }

  async locationCounts(locationIds: string[], since: Date) {
    if (!locationIds.length)
      return new Map<
        string,
        { recent: number; open: number; waiting: number }
      >();
    const rows = await this.db
      .select({
        locationId: gbpReviews.locationId,
        recent: sql<number>`count(*) filter (where ${gbpReviews.reviewedAt} >= ${since.toISOString()}::timestamptz)`,
        open: sql<number>`count(*) filter (where ${gbpReviews.skippedAt} is null and (${gbpReviews.replyText} is null or ${gbpReviews.editedAfterReply}))`,
        waiting: sql<number>`count(*) filter (where exists (select 1 from gbp_replies r where r.review_id = gbp_reviews.id and r.status = 'pending_approval'))`,
      })
      .from(gbpReviews)
      .where(inArray(gbpReviews.locationId, locationIds))
      .groupBy(gbpReviews.locationId);
    return new Map(
      rows.map((r) => [
        r.locationId,
        {
          recent: Number(r.recent),
          open: Number(r.open),
          waiting: Number(r.waiting),
        },
      ]),
    );
  }

  repliesFor(reviewIds: string[]) {
    if (!reviewIds.length) return Promise.resolve([]);
    return this.db
      .select()
      .from(gbpReplies)
      .where(inArray(gbpReplies.reviewId, reviewIds))
      .orderBy(desc(gbpReplies.createdAt));
  }

  async activeReply(reviewId: string, tx: Executor = this.db) {
    return firstOrNull(
      await tx
        .select()
        .from(gbpReplies)
        .where(and(eq(gbpReplies.reviewId, reviewId), ACTIVE))
        .limit(1),
    );
  }

  async reply(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpReplies)
        .where(
          and(eq(gbpReplies.workspaceId, workspaceId), eq(gbpReplies.id, id)),
        )
        .limit(1),
    );
  }

  async insertReply(
    values: typeof gbpReplies.$inferInsert,
    tx: Executor = this.db,
  ) {
    const [row] = await tx.insert(gbpReplies).values(values).returning();
    return row!;
  }

  async updateReply(
    id: string,
    values: Partial<typeof gbpReplies.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(gbpReplies)
      .set(values)
      .where(eq(gbpReplies.id, id))
      .returning();
    return row!;
  }

  dueReplies(now: Date, limit: number) {
    return this.db
      .select()
      .from(gbpReplies)
      .where(
        and(eq(gbpReplies.status, "scheduled"), lte(gbpReplies.sendAt, now)),
      )
      .orderBy(asc(gbpReplies.sendAt))
      .limit(limit);
  }

  async autoRepliesSince(locationId: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(gbpReplies)
      .where(
        and(
          eq(gbpReplies.locationId, locationId),
          eq(gbpReplies.auto, true),
          or(
            eq(gbpReplies.status, "scheduled"),
            and(eq(gbpReplies.status, "sent"), gte(gbpReplies.sentAt, since)),
          ),
        ),
      );
    return row?.n ?? 0;
  }

  async aiDraftsSince(workspaceId: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(gbpReplies)
      .where(
        and(
          eq(gbpReplies.workspaceId, workspaceId),
          eq(gbpReplies.source, "ai"),
          gte(gbpReplies.createdAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  async sentRepliesBetween(
    workspaceId: string,
    locationIds: string[],
    from: Date,
    to: Date,
  ) {
    if (!locationIds.length) return 0;
    const [row] = await this.db
      .select({ n: count() })
      .from(gbpReplies)
      .where(
        and(
          eq(gbpReplies.workspaceId, workspaceId),
          inArray(gbpReplies.locationId, locationIds),
          eq(gbpReplies.status, "sent"),
          gte(gbpReplies.sentAt, from),
          lte(gbpReplies.sentAt, to),
        ),
      );
    return row?.n ?? 0;
  }

  async holdScheduled(locationId: string, note: string) {
    await this.db
      .update(gbpReplies)
      .set({ status: "pending_approval", sendAt: null, note })
      .where(
        and(
          eq(gbpReplies.locationId, locationId),
          eq(gbpReplies.status, "scheduled"),
        ),
      );
  }

  templates(workspaceId: string, locationId?: string) {
    return this.db
      .select()
      .from(gbpTemplates)
      .where(
        and(
          eq(gbpTemplates.workspaceId, workspaceId),
          locationId
            ? or(
                isNull(gbpTemplates.locationId),
                eq(gbpTemplates.locationId, locationId),
              )
            : undefined,
        ),
      )
      .orderBy(asc(gbpTemplates.createdAt));
  }

  async template(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpTemplates)
        .where(
          and(
            eq(gbpTemplates.workspaceId, workspaceId),
            eq(gbpTemplates.id, id),
          ),
        )
        .limit(1),
    );
  }

  async insertTemplates(values: (typeof gbpTemplates.$inferInsert)[]) {
    if (!values.length) return [];
    return this.db
      .insert(gbpTemplates)
      .values(values)
      .onConflictDoNothing()
      .returning();
  }

  async updateTemplate(
    id: string,
    values: Partial<typeof gbpTemplates.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(gbpTemplates)
      .set(values)
      .where(eq(gbpTemplates.id, id))
      .returning();
    return row!;
  }

  async deleteTemplate(id: string) {
    await this.db.delete(gbpTemplates).where(eq(gbpTemplates.id, id));
  }

  posts(workspaceId: string, locationIds: string[], limit: number) {
    if (!locationIds.length) return Promise.resolve([]);
    return this.db
      .select()
      .from(gbpPosts)
      .where(
        and(
          eq(gbpPosts.workspaceId, workspaceId),
          inArray(gbpPosts.locationId, locationIds),
        ),
      )
      .orderBy(
        desc(
          sql`coalesce(${gbpPosts.publishedAt}, ${gbpPosts.scheduledAt}, ${gbpPosts.createdAt})`,
        ),
      )
      .limit(limit);
  }

  async post(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(gbpPosts)
        .where(and(eq(gbpPosts.workspaceId, workspaceId), eq(gbpPosts.id, id)))
        .limit(1),
    );
  }

  async insertPost(values: typeof gbpPosts.$inferInsert) {
    const [row] = await this.db.insert(gbpPosts).values(values).returning();
    return row!;
  }

  async updatePost(id: string, values: Partial<typeof gbpPosts.$inferInsert>) {
    const [row] = await this.db
      .update(gbpPosts)
      .set(values)
      .where(eq(gbpPosts.id, id))
      .returning();
    return row!;
  }

  async deletePost(id: string) {
    await this.db.delete(gbpPosts).where(eq(gbpPosts.id, id));
  }

  duePosts(now: Date, limit: number) {
    return this.db
      .select()
      .from(gbpPosts)
      .where(
        and(eq(gbpPosts.status, "scheduled"), lte(gbpPosts.scheduledAt, now)),
      )
      .orderBy(asc(gbpPosts.scheduledAt))
      .limit(limit);
  }

  async saveMetrics(
    locationId: string,
    rows: ({ day: string } & DailyMetrics)[],
  ) {
    if (!rows.length) return;
    await this.db
      .insert(gbpMetrics)
      .values(rows.map(({ day, ...values }) => ({ locationId, day, values })))
      .onConflictDoUpdate({
        target: [gbpMetrics.locationId, gbpMetrics.day],
        set: { values: sql`excluded.values`, updatedAt: new Date() },
      });
  }

  metrics(locationIds: string[], from: string, to: string) {
    if (!locationIds.length) return Promise.resolve([]);
    return this.db
      .select()
      .from(gbpMetrics)
      .where(
        and(
          inArray(gbpMetrics.locationId, locationIds),
          gte(gbpMetrics.day, from),
          lte(gbpMetrics.day, to),
        ),
      )
      .orderBy(asc(gbpMetrics.day));
  }
}
