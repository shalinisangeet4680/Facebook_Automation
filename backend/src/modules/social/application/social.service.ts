import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { and, desc, eq, inArray } from "drizzle-orm";

import { AuditService } from "@modules/audit/application/audit.service";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { AssetView } from "@modules/meta/domain/meta.types";
import {
  LibraryPost,
  META_PUBLISHING,
  MetaPublishing,
} from "@modules/meta/domain/ports/meta-publishing";
import { CacheService } from "@shared/cache/cache.service";
import { AppConfig, mediaUrl } from "@shared/config/app-config";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import {
  CodedError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";
import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import {
  captionProblem,
  Platform,
  scheduleProblem,
} from "../domain/post.rules";
import { SocialPostRow, socialPosts } from "../infrastructure/social.tables";

const LIBRARY_CACHE_SECONDS = 300;
const RETRYABLE = new Set<string>([
  ErrorCode.META_UNAVAILABLE,
  ErrorCode.META_THROTTLED,
]);

export interface SocialActor {
  userId: string;
  workspaceId: string;
  via: string;
}

export interface CreatePostInput {
  creativeId: string;
  platforms: Platform[];
  facebookCaption?: string | null;
  instagramCaption?: string | null;
  scheduledAt?: string | null;
}

export class RetryLaterError extends Error {}

export interface Channels {
  facebook: { id: string; name: string } | null;
  instagram: { id: string; username: string } | null;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(META_PUBLISHING) private readonly publishing: MetaPublishing,
    @InjectQueue(QUEUES.SOCIAL) private readonly queue: Queue,
    private readonly connections: MetaConnectionService,
    private readonly creatives: CreativesService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  async channels(workspaceId: string): Promise<Channels> {
    const { data } = await this.connections.listAssets(workspaceId);
    const primary = (kind: AssetView["kind"]) =>
      data.find((a) => a.kind === kind && a.isPrimary) ?? null;
    const page = primary("page");
    const instagram = primary("instagram");
    return {
      facebook: page ? { id: page.externalId, name: page.name } : null,
      instagram: instagram
        ? { id: instagram.externalId, username: instagram.name }
        : null,
    };
  }

  view(row: SocialPostRow) {
    return {
      id: row.id,
      creativeId: row.creativeId,
      imageUrl: row.imageUrl,
      mediaType: row.mediaType as "image" | "video",
      platforms: row.platforms as Platform[],
      facebookCaption: row.facebookCaption,
      instagramCaption: row.instagramCaption,
      status: row.status,
      scheduledAt: row.scheduledAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      facebook: row.platforms.includes("facebook")
        ? {
            postId: row.facebookPostId,
            permalink: row.facebookPermalink,
            error: row.facebookError,
          }
        : null,
      instagram: row.platforms.includes("instagram")
        ? {
            mediaId: row.instagramMediaId,
            permalink: row.instagramPermalink,
            error: row.instagramError,
          }
        : null,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async validate(actor: SocialActor, input: CreatePostInput) {
    const platforms = [...new Set(input.platforms)];
    if (!platforms.length)
      throw new ValidationError("Choose Facebook, Instagram or both.");
    const channels = await this.channels(actor.workspaceId);
    for (const platform of platforms) {
      if (!channels[platform]) {
        throw new CodedError(
          ErrorCode.META_ASSETS_MISSING,
          422,
          platform === "facebook"
            ? "Select a Facebook Page in Setup first."
            : "No Instagram account is connected. Link it to your Page and refresh accounts in Setup.",
        );
      }
      const problem = captionProblem(
        platform,
        platform === "facebook"
          ? input.facebookCaption
          : input.instagramCaption,
      );
      if (problem) throw new ValidationError(problem);
    }
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const scheduleError = scheduleProblem(scheduledAt);
    if (scheduleError) throw new ValidationError(scheduleError);
    const creative = await this.creatives.get(
      actor.workspaceId,
      input.creativeId,
    );
    if (creative.kind === "video") {
      const duration = creative.durationSeconds ?? 0;
      const vertical = creative.height / creative.width;
      if (
        platforms.includes("facebook") &&
        (duration < 3 || duration > 90 || vertical < 1.7 || vertical > 1.8)
      ) {
        throw new ValidationError(
          "Facebook Reels need a vertical 9:16 video between 3 and 90 seconds.",
        );
      }
      if (platforms.includes("instagram") && (duration < 3 || duration > 900)) {
        throw new ValidationError(
          "Instagram Reels must be between 3 seconds and 15 minutes.",
        );
      }
    }
    return { platforms, scheduledAt, creative, channels };
  }

  async create(actor: SocialActor, input: CreatePostInput) {
    const { platforms, scheduledAt, creative } = await this.validate(
      actor,
      input,
    );
    const [row] = await this.db
      .insert(socialPosts)
      .values({
        workspaceId: actor.workspaceId,
        creativeId: creative.id,
        imageUrl: mediaUrl(this.config, creative.storageKey),
        mediaType: creative.kind,
        platforms,
        facebookCaption: platforms.includes("facebook")
          ? input.facebookCaption!.trim()
          : null,
        instagramCaption: platforms.includes("instagram")
          ? input.instagramCaption!.trim()
          : null,
        scheduledAt: scheduledAt ?? new Date(),
        source: actor.via,
        createdBy: actor.userId,
      })
      .returning();
    const post = row!;
    await this.queue.add(
      JOBS.PUBLISH_POST,
      { workspaceId: actor.workspaceId, postId: post.id },
      {
        jobId: post.id,
        delay: scheduledAt ? scheduledAt.getTime() - Date.now() : 0,
        attempts: 4,
      },
    );
    await this.record(
      actor,
      scheduledAt ? "social.scheduled" : "social.publish_requested",
      post.id,
      {
        platforms,
        scheduledAt: post.scheduledAt.toISOString(),
      },
    );
    return this.view(post);
  }

  async cancel(actor: SocialActor, id: string) {
    const [row] = await this.db
      .update(socialPosts)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(socialPosts.id, id),
          eq(socialPosts.workspaceId, actor.workspaceId),
          eq(socialPosts.status, "scheduled"),
        ),
      )
      .returning();
    if (!row) {
      const existing = await this.find(actor.workspaceId, id);
      if (!existing) throw new NotFoundError("This post doesn't exist.");
      throw new CodedError(
        ErrorCode.CONFLICT,
        409,
        "Only scheduled posts can be cancelled.",
      );
    }
    await this.queue.remove(id).catch(() => undefined);
    await this.record(actor, "social.cancelled", id, {});
    return this.view(row);
  }

  async retry(actor: SocialActor, id: string) {
    const [row] = await this.db
      .update(socialPosts)
      .set({ status: "scheduled", scheduledAt: new Date() })
      .where(
        and(
          eq(socialPosts.id, id),
          eq(socialPosts.workspaceId, actor.workspaceId),
          inArray(socialPosts.status, ["failed", "partially_published"]),
        ),
      )
      .returning();
    if (!row) {
      const existing = await this.find(actor.workspaceId, id);
      if (!existing) throw new NotFoundError("This post doesn't exist.");
      throw new CodedError(
        ErrorCode.CONFLICT,
        409,
        "Only failed posts can be retried.",
      );
    }
    await this.queue.remove(id).catch(() => undefined);
    await this.queue.add(
      JOBS.PUBLISH_POST,
      { workspaceId: actor.workspaceId, postId: id },
      { jobId: `${id}-retry-${Date.now()}`, attempts: 4 },
    );
    await this.record(actor, "social.retried", id, {});
    return this.view(row);
  }

  async list(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.workspaceId, workspaceId))
      .orderBy(desc(socialPosts.scheduledAt))
      .limit(100);
    return { data: rows.map((r) => this.view(r)) };
  }

  async find(workspaceId: string, id: string): Promise<SocialPostRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(socialPosts)
        .where(
          and(eq(socialPosts.id, id), eq(socialPosts.workspaceId, workspaceId)),
        )
        .limit(1),
    );
  }

  async library(
    workspaceId: string,
    platform: Platform,
  ): Promise<{ connected: boolean; data: LibraryPost[] }> {
    const channels = await this.channels(workspaceId);
    const channel = channels[platform];
    if (!channel) return { connected: false, data: [] };
    const key = `social:library:${workspaceId}:${platform}:${channel.id}`;
    const cached = await this.cache.get<LibraryPost[]>(key);
    if (cached) return { connected: true, data: cached };
    const token = await this.connections.accessToken(workspaceId);
    const data =
      platform === "facebook"
        ? await this.publishing.facebookPosts(token, channel.id, 30)
        : await this.publishing.instagramPosts(token, channel.id, 30);
    await this.cache.set(key, data, LIBRARY_CACHE_SECONDS);
    return { connected: true, data };
  }

  async publish(
    postId: string,
    finalAttempt: boolean,
  ): Promise<SocialPostRow | null> {
    const [claimed] = await this.db
      .update(socialPosts)
      .set({ status: "publishing" })
      .where(
        and(
          eq(socialPosts.id, postId),
          inArray(socialPosts.status, ["scheduled", "publishing"]),
        ),
      )
      .returning();
    if (!claimed) return null;

    const channels = await this.channels(claimed.workspaceId);
    let token: string;
    try {
      token = await this.connections.accessToken(claimed.workspaceId);
    } catch (err) {
      return this.finish(claimed, {
        facebookError: this.message(err),
        instagramError: this.message(err),
      });
    }

    const updates: Partial<typeof socialPosts.$inferInsert> = {};
    let retry = false;
    const attempt = async (
      platform: Platform,
      run: () => Promise<{ id: string; permalink: string | null }>,
    ) => {
      try {
        const result = await run();
        if (platform === "facebook")
          Object.assign(updates, {
            facebookPostId: result.id,
            facebookPermalink: result.permalink,
            facebookError: null,
          });
        else
          Object.assign(updates, {
            instagramMediaId: result.id,
            instagramPermalink: result.permalink,
            instagramError: null,
          });
      } catch (err) {
        if (
          !finalAttempt &&
          err instanceof DomainError &&
          RETRYABLE.has(err.code)
        )
          retry = true;
        if (platform === "facebook") updates.facebookError = this.message(err);
        else updates.instagramError = this.message(err);
      }
    };

    if (claimed.platforms.includes("facebook") && !claimed.facebookPostId) {
      const page = channels.facebook;
      if (!page) updates.facebookError = "No Facebook Page is selected.";
      else
        await attempt("facebook", () =>
          claimed.mediaType === "video"
            ? this.publishing.publishFacebookReel(
                token,
                page.id,
                claimed.imageUrl,
                claimed.facebookCaption ?? "",
              )
            : this.publishing.publishFacebookPhoto(
                token,
                page.id,
                claimed.imageUrl,
                claimed.facebookCaption ?? "",
              ),
        );
    }
    if (claimed.platforms.includes("instagram") && !claimed.instagramMediaId) {
      const ig = channels.instagram;
      if (!ig) updates.instagramError = "No Instagram account is connected.";
      else
        await attempt("instagram", () =>
          claimed.mediaType === "video"
            ? this.publishing.publishInstagramReel(
                token,
                ig.id,
                claimed.imageUrl,
                claimed.instagramCaption ?? "",
              )
            : this.publishing.publishInstagramImage(
                token,
                ig.id,
                claimed.imageUrl,
                claimed.instagramCaption ?? "",
              ),
        );
    }

    if (retry) {
      await this.db
        .update(socialPosts)
        .set(updates)
        .where(eq(socialPosts.id, claimed.id));
      throw new RetryLaterError("Meta is unavailable; retrying");
    }
    return this.finish(claimed, updates);
  }

  private async finish(
    row: SocialPostRow,
    updates: Partial<typeof socialPosts.$inferInsert>,
  ) {
    const merged = { ...row, ...updates };
    const wanted = row.platforms;
    const done = wanted.filter((p) =>
      p === "facebook" ? merged.facebookPostId : merged.instagramMediaId,
    );
    const status =
      done.length === wanted.length
        ? "published"
        : done.length
          ? "partially_published"
          : "failed";
    const [saved] = await this.db
      .update(socialPosts)
      .set({ ...updates, status, publishedAt: done.length ? new Date() : null })
      .where(eq(socialPosts.id, row.id))
      .returning();
    await this.cache.del(
      `social:library:${row.workspaceId}:facebook:${(await this.channels(row.workspaceId)).facebook?.id ?? ""}`,
      `social:library:${row.workspaceId}:instagram:${(await this.channels(row.workspaceId)).instagram?.id ?? ""}`,
    );
    await this.audit.record({
      workspaceId: row.workspaceId,
      actor: "system",
      action: `social.${status}`,
      target: row.id,
      data: {
        facebookPostId: saved!.facebookPostId,
        instagramMediaId: saved!.instagramMediaId,
        facebookError: saved!.facebookError,
        instagramError: saved!.instagramError,
      },
    });
    if (status !== "published") this.logger.warn(`Post ${row.id} ${status}`);
    return saved!;
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : "Publishing failed.";
  }

  private record(
    actor: SocialActor,
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
