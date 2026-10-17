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
  SQL,
} from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";

import {
  AccountMetricValues,
  BrandKit,
  CommentClass,
  PostMetricValues,
  PostStatus,
  SocialPlatform,
} from "../domain/social.types";
import {
  SocialAccountRow,
  brandKits,
  socialAccountMetrics,
  socialAccounts,
  socialAutoposts,
  socialCommentReplies,
  socialComments,
  socialPlans,
  socialPostMetrics,
} from "./social-engine.tables";

const ACTIVE_REPLY = sql`${socialCommentReplies.status} in ('pending_approval', 'needs_claude', 'scheduled')`;

export interface PostFilter {
  platform?: SocialPlatform;
  accountId?: string;
  statuses?: PostStatus[];
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface CommentFilter {
  platform?: SocialPlatform;
  accountId?: string;
  classes?: CommentClass[];
  state?: "open" | "replied" | "all";
  limit?: number;
}

@Injectable()
export class SocialEngineRepository {
  constructor(@Inject(DATABASE) readonly db: Database) {}

  accounts(workspaceId: string, platform?: SocialPlatform) {
    return this.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, workspaceId),
          platform ? eq(socialAccounts.platform, platform) : undefined,
        ),
      )
      .orderBy(asc(socialAccounts.createdAt));
  }

  async account(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, workspaceId),
            eq(socialAccounts.id, id),
          ),
        )
        .limit(1),
    );
  }

  async accountById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, id))
        .limit(1),
    );
  }

  async upsertAccount(values: typeof socialAccounts.$inferInsert) {
    const existing = firstOrNull(
      await this.db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, values.workspaceId),
            eq(socialAccounts.platform, values.platform),
            eq(socialAccounts.externalId, values.externalId),
          ),
        )
        .limit(1),
    );
    if (existing) {
      const [row] = await this.db
        .update(socialAccounts)
        .set({
          login: values.login,
          name: values.name,
          username: values.username,
          avatarUrl: values.avatarUrl,
          category: values.category,
          pageId: values.pageId,
          tokenCiphertext: values.tokenCiphertext,
          tokenExpiresAt: values.tokenExpiresAt,
          followers: values.followers,
          status: "active",
          error: null,
        })
        .where(eq(socialAccounts.id, existing.id))
        .returning();
      return { row: row!, created: false };
    }
    const [row] = await this.db
      .insert(socialAccounts)
      .values(values)
      .returning();
    return { row: row!, created: true };
  }

  async updateAccount(
    id: string,
    values: Partial<typeof socialAccounts.$inferInsert>,
  ): Promise<SocialAccountRow> {
    const [row] = await this.db
      .update(socialAccounts)
      .set(values)
      .where(eq(socialAccounts.id, id))
      .returning();
    return row!;
  }

  async deleteAccount(id: string) {
    await this.db.delete(socialAccounts).where(eq(socialAccounts.id, id));
  }

  accountsDue(
    column: "commentsSyncedAt" | "metricsSyncedAt",
    before: Date,
    limit: number,
  ) {
    const col = socialAccounts[column];
    return this.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.status, "active"),
          or(isNull(col), lt(col, before)),
        ),
      )
      .orderBy(asc(col))
      .limit(limit);
  }

  accountsExpiring(before: Date, limit: number) {
    return this.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.status, "active"),
          isNotNull(socialAccounts.tokenExpiresAt),
          lt(socialAccounts.tokenExpiresAt, before),
        ),
      )
      .limit(limit);
  }

  activeAccounts(limit: number) {
    return this.db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.status, "active"))
      .orderBy(asc(socialAccounts.createdAt))
      .limit(limit);
  }

  async brandKit(workspaceId: string, accountId: string | null) {
    return firstOrNull(
      await this.db
        .select()
        .from(brandKits)
        .where(
          and(
            eq(brandKits.workspaceId, workspaceId),
            accountId
              ? eq(brandKits.accountId, accountId)
              : isNull(brandKits.accountId),
          ),
        )
        .limit(1),
    );
  }

  async saveBrandKit(
    workspaceId: string,
    accountId: string | null,
    kit: BrandKit,
    prefilled = false,
  ) {
    const existing = await this.brandKit(workspaceId, accountId);
    const extra = prefilled ? { prefilledAt: new Date() } : {};
    if (existing) {
      const [row] = await this.db
        .update(brandKits)
        .set({ kit, ...extra })
        .where(eq(brandKits.id, existing.id))
        .returning();
      return row!;
    }
    const [row] = await this.db
      .insert(brandKits)
      .values({ workspaceId, accountId, kit, ...extra })
      .returning();
    return row!;
  }

  async deleteBrandKit(workspaceId: string, accountId: string) {
    await this.db
      .delete(brandKits)
      .where(
        and(
          eq(brandKits.workspaceId, workspaceId),
          eq(brandKits.accountId, accountId),
        ),
      );
  }

  async plan(accountId: string, weekStart: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialPlans)
        .where(
          and(
            eq(socialPlans.accountId, accountId),
            eq(socialPlans.weekStart, weekStart),
          ),
        )
        .limit(1),
    );
  }

  async savePlan(values: typeof socialPlans.$inferInsert) {
    const [row] = await this.db
      .insert(socialPlans)
      .values(values)
      .onConflictDoUpdate({
        target: [socialPlans.accountId, socialPlans.weekStart],
        set: {
          summary: values.summary,
          source: values.source,
          createdBy: values.createdBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  plans(workspaceId: string, accountIds: string[], limit = 20) {
    if (!accountIds.length) return Promise.resolve([]);
    return this.db
      .select()
      .from(socialPlans)
      .where(
        and(
          eq(socialPlans.workspaceId, workspaceId),
          inArray(socialPlans.accountId, accountIds),
        ),
      )
      .orderBy(desc(socialPlans.weekStart))
      .limit(limit);
  }

  async clearPlanDrafts(planId: string) {
    await this.db
      .delete(socialAutoposts)
      .where(
        and(
          eq(socialAutoposts.planId, planId),
          inArray(socialAutoposts.status, [
            "draft",
            "pending_approval",
            "scheduled",
          ]),
        ),
      );
  }

  async insertPost(values: typeof socialAutoposts.$inferInsert) {
    const [row] = await this.db
      .insert(socialAutoposts)
      .values(values)
      .returning();
    return row!;
  }

  async insertPosts(values: (typeof socialAutoposts.$inferInsert)[]) {
    if (!values.length) return [];
    return this.db
      .insert(socialAutoposts)
      .values(values)
      .onConflictDoNothing()
      .returning();
  }

  async updatePost(
    id: string,
    values: Partial<typeof socialAutoposts.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(socialAutoposts)
      .set(values)
      .where(eq(socialAutoposts.id, id))
      .returning();
    return row!;
  }

  async deletePost(id: string) {
    await this.db.delete(socialAutoposts).where(eq(socialAutoposts.id, id));
  }

  async post(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialAutoposts)
        .where(
          and(
            eq(socialAutoposts.workspaceId, workspaceId),
            eq(socialAutoposts.id, id),
          ),
        )
        .limit(1),
    );
  }

  async postById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialAutoposts)
        .where(eq(socialAutoposts.id, id))
        .limit(1),
    );
  }

  posts(workspaceId: string, f: PostFilter, order: "asc" | "desc" = "asc") {
    const when = sql`coalesce(${socialAutoposts.publishedAt}, ${socialAutoposts.scheduledAt}, ${socialAutoposts.createdAt})`;
    const conditions: (SQL | undefined)[] = [
      eq(socialAutoposts.workspaceId, workspaceId),
      f.platform ? eq(socialAutoposts.platform, f.platform) : undefined,
      f.accountId ? eq(socialAutoposts.accountId, f.accountId) : undefined,
      f.statuses?.length
        ? inArray(socialAutoposts.status, f.statuses)
        : undefined,
      f.from ? sql`${when} >= ${f.from.toISOString()}` : undefined,
      f.to ? sql`${when} < ${f.to.toISOString()}` : undefined,
    ];
    return this.db
      .select()
      .from(socialAutoposts)
      .where(and(...conditions))
      .orderBy(order === "asc" ? asc(when) : desc(when))
      .limit(f.limit ?? 200);
  }

  async claimDue(now: Date, limit: number) {
    const due = await this.db
      .select({ id: socialAutoposts.id })
      .from(socialAutoposts)
      .where(
        and(
          eq(socialAutoposts.status, "scheduled"),
          lte(socialAutoposts.scheduledAt, now),
        ),
      )
      .orderBy(asc(socialAutoposts.scheduledAt))
      .limit(limit);
    if (!due.length) return [];
    return this.db
      .update(socialAutoposts)
      .set({ status: "publishing" })
      .where(
        and(
          inArray(
            socialAutoposts.id,
            due.map((d) => d.id),
          ),
          eq(socialAutoposts.status, "scheduled"),
        ),
      )
      .returning();
  }

  async claimPost(id: string) {
    const [row] = await this.db
      .update(socialAutoposts)
      .set({ status: "publishing" })
      .where(
        and(
          eq(socialAutoposts.id, id),
          inArray(socialAutoposts.status, [
            "draft",
            "pending_approval",
            "scheduled",
            "failed",
          ]),
        ),
      )
      .returning();
    return row ?? null;
  }

  async countPosts(accountId: string, from: Date, to: Date, exceptId?: string) {
    const [row] = await this.db
      .select({ n: count() })
      .from(socialAutoposts)
      .where(
        and(
          eq(socialAutoposts.accountId, accountId),
          inArray(socialAutoposts.status, [
            "scheduled",
            "publishing",
            "published",
          ]),
          sql`coalesce(${socialAutoposts.publishedAt}, ${socialAutoposts.scheduledAt}) >= ${from.toISOString()}`,
          sql`coalesce(${socialAutoposts.publishedAt}, ${socialAutoposts.scheduledAt}) < ${to.toISOString()}`,
          exceptId ? sql`${socialAutoposts.id} <> ${exceptId}` : undefined,
        ),
      );
    return row?.n ?? 0;
  }

  async publishedCount(accountId: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(socialAutoposts)
      .where(
        and(
          eq(socialAutoposts.accountId, accountId),
          eq(socialAutoposts.status, "published"),
          gte(socialAutoposts.publishedAt, since),
          sql`${socialAutoposts.source} <> 'imported'`,
        ),
      );
    return row?.n ?? 0;
  }

  publishedSince(accountId: string, since: Date) {
    return this.db
      .select()
      .from(socialAutoposts)
      .where(
        and(
          eq(socialAutoposts.accountId, accountId),
          eq(socialAutoposts.status, "published"),
          isNotNull(socialAutoposts.externalId),
          gte(socialAutoposts.publishedAt, since),
        ),
      )
      .orderBy(desc(socialAutoposts.publishedAt))
      .limit(100);
  }

  async holdScheduled(accountId: string, reason: string) {
    await this.db
      .update(socialAutoposts)
      .set({ status: "pending_approval", heldReason: reason })
      .where(
        and(
          eq(socialAutoposts.accountId, accountId),
          eq(socialAutoposts.status, "scheduled"),
          eq(socialAutoposts.mode, "auto"),
        ),
      );
    await this.db
      .update(socialCommentReplies)
      .set({ status: "pending_approval", sendAt: null, note: reason })
      .where(
        and(
          eq(socialCommentReplies.accountId, accountId),
          eq(socialCommentReplies.status, "scheduled"),
        ),
      );
  }

  async savePostMetrics(postId: string, day: string, values: PostMetricValues) {
    await this.db
      .insert(socialPostMetrics)
      .values({ postId, day, values })
      .onConflictDoUpdate({
        target: [socialPostMetrics.postId, socialPostMetrics.day],
        set: { values, updatedAt: new Date() },
      });
  }

  async latestPostMetrics(postIds: string[]) {
    const out = new Map<string, PostMetricValues>();
    if (!postIds.length) return out;
    const rows = await this.db
      .selectDistinctOn([socialPostMetrics.postId])
      .from(socialPostMetrics)
      .where(inArray(socialPostMetrics.postId, postIds))
      .orderBy(socialPostMetrics.postId, desc(socialPostMetrics.day));
    for (const r of rows) out.set(r.postId, r.values);
    return out;
  }

  async saveAccountMetrics(
    accountId: string,
    rows: ({ day: string } & AccountMetricValues)[],
  ) {
    for (const { day, ...values } of rows)
      await this.db
        .insert(socialAccountMetrics)
        .values({ accountId, day, values })
        .onConflictDoUpdate({
          target: [socialAccountMetrics.accountId, socialAccountMetrics.day],
          set: {
            values: sql`excluded.values || jsonb_build_object('followers', greatest((excluded.values->>'followers')::int, coalesce((${socialAccountMetrics.values}->>'followers')::int, 0)))`,
            updatedAt: new Date(),
          },
        });
  }

  accountMetrics(accountIds: string[], from: string, to: string) {
    if (!accountIds.length) return Promise.resolve([]);
    return this.db
      .select()
      .from(socialAccountMetrics)
      .where(
        and(
          inArray(socialAccountMetrics.accountId, accountIds),
          gte(socialAccountMetrics.day, from),
          lte(socialAccountMetrics.day, to),
        ),
      )
      .orderBy(asc(socialAccountMetrics.day));
  }

  async commentsByExternal(accountId: string, ids: string[]) {
    if (!ids.length) return [];
    return this.db
      .select()
      .from(socialComments)
      .where(
        and(
          eq(socialComments.accountId, accountId),
          inArray(socialComments.externalId, ids),
        ),
      );
  }

  async insertComment(values: typeof socialComments.$inferInsert) {
    const [row] = await this.db
      .insert(socialComments)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return row ?? null;
  }

  async updateComment(
    id: string,
    values: Partial<typeof socialComments.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(socialComments)
      .set(values)
      .where(eq(socialComments.id, id))
      .returning();
    return row!;
  }

  async comment(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialComments)
        .where(
          and(
            eq(socialComments.workspaceId, workspaceId),
            eq(socialComments.id, id),
          ),
        )
        .limit(1),
    );
  }

  async commentById(id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialComments)
        .where(eq(socialComments.id, id))
        .limit(1),
    );
  }

  comments(workspaceId: string, accountIds: string[], f: CommentFilter) {
    if (!accountIds.length) return Promise.resolve([]);
    const state =
      f.state === "open"
        ? and(
            isNull(socialComments.replyText),
            isNull(socialComments.skippedAt),
            eq(socialComments.hidden, false),
          )
        : f.state === "replied"
          ? isNotNull(socialComments.replyText)
          : undefined;
    return this.db
      .select()
      .from(socialComments)
      .where(
        and(
          eq(socialComments.workspaceId, workspaceId),
          inArray(socialComments.accountId, accountIds),
          f.classes?.length
            ? inArray(socialComments.class, f.classes)
            : undefined,
          state,
        ),
      )
      .orderBy(desc(socialComments.commentedAt))
      .limit(f.limit ?? 100);
  }

  async commentCounts(accountIds: string[]) {
    const out = new Map<string, { open: number; waiting: number }>();
    if (!accountIds.length) return out;
    const open = await this.db
      .select({ accountId: socialComments.accountId, n: count() })
      .from(socialComments)
      .where(
        and(
          inArray(socialComments.accountId, accountIds),
          isNull(socialComments.replyText),
          isNull(socialComments.skippedAt),
          eq(socialComments.hidden, false),
          sql`${socialComments.class} <> 'spam'`,
        ),
      )
      .groupBy(socialComments.accountId);
    const waiting = await this.db
      .select({ accountId: socialCommentReplies.accountId, n: count() })
      .from(socialCommentReplies)
      .where(
        and(
          inArray(socialCommentReplies.accountId, accountIds),
          eq(socialCommentReplies.status, "pending_approval"),
        ),
      )
      .groupBy(socialCommentReplies.accountId);
    for (const id of accountIds)
      out.set(id, {
        open: open.find((r) => r.accountId === id)?.n ?? 0,
        waiting: waiting.find((r) => r.accountId === id)?.n ?? 0,
      });
    return out;
  }

  async postCounts(accountIds: string[]) {
    const out = new Map<string, { pending: number; scheduled: number }>();
    if (!accountIds.length) return out;
    const rows = await this.db
      .select({
        accountId: socialAutoposts.accountId,
        status: socialAutoposts.status,
        n: count(),
      })
      .from(socialAutoposts)
      .where(
        and(
          inArray(socialAutoposts.accountId, accountIds),
          inArray(socialAutoposts.status, ["pending_approval", "scheduled"]),
        ),
      )
      .groupBy(socialAutoposts.accountId, socialAutoposts.status);
    for (const id of accountIds)
      out.set(id, {
        pending:
          rows.find(
            (r) => r.accountId === id && r.status === "pending_approval",
          )?.n ?? 0,
        scheduled:
          rows.find((r) => r.accountId === id && r.status === "scheduled")?.n ??
          0,
      });
    return out;
  }

  async activeReply(commentId: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialCommentReplies)
        .where(and(eq(socialCommentReplies.commentId, commentId), ACTIVE_REPLY))
        .limit(1),
    );
  }

  async repliesFor(commentIds: string[]) {
    if (!commentIds.length) return [];
    return this.db
      .select()
      .from(socialCommentReplies)
      .where(inArray(socialCommentReplies.commentId, commentIds))
      .orderBy(desc(socialCommentReplies.createdAt));
  }

  async insertReply(values: typeof socialCommentReplies.$inferInsert) {
    const [row] = await this.db
      .insert(socialCommentReplies)
      .values(values)
      .returning();
    return row!;
  }

  async updateReply(
    id: string,
    values: Partial<typeof socialCommentReplies.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(socialCommentReplies)
      .set(values)
      .where(eq(socialCommentReplies.id, id))
      .returning();
    return row!;
  }

  async reply(workspaceId: string, id: string) {
    return firstOrNull(
      await this.db
        .select()
        .from(socialCommentReplies)
        .where(
          and(
            eq(socialCommentReplies.workspaceId, workspaceId),
            eq(socialCommentReplies.id, id),
          ),
        )
        .limit(1),
    );
  }

  dueReplies(now: Date, limit: number) {
    return this.db
      .select()
      .from(socialCommentReplies)
      .where(
        and(
          eq(socialCommentReplies.status, "scheduled"),
          lte(socialCommentReplies.sendAt, now),
        ),
      )
      .orderBy(asc(socialCommentReplies.sendAt))
      .limit(limit);
  }

  async autoRepliesSince(accountId: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(socialCommentReplies)
      .where(
        and(
          eq(socialCommentReplies.accountId, accountId),
          eq(socialCommentReplies.auto, true),
          gte(socialCommentReplies.createdAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  async aiDraftsSince(workspaceId: string, since: Date) {
    const [replies] = await this.db
      .select({ n: count() })
      .from(socialCommentReplies)
      .where(
        and(
          eq(socialCommentReplies.workspaceId, workspaceId),
          eq(socialCommentReplies.source, "ai"),
          gte(socialCommentReplies.createdAt, since),
        ),
      );
    const [posts] = await this.db
      .select({ n: count() })
      .from(socialAutoposts)
      .where(
        and(
          eq(socialAutoposts.workspaceId, workspaceId),
          eq(socialAutoposts.aiWritten, true),
          gte(socialAutoposts.createdAt, since),
        ),
      );
    return (replies?.n ?? 0) + (posts?.n ?? 0);
  }
}
