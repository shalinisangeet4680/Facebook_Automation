import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuditService } from "@modules/audit/application/audit.service";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { draftPost } from "@modules/engine/domain/post-drafts";
import {
  POST_AI,
  PostAi,
  PostAiResult,
} from "@modules/engine/domain/ports/post-ai";
import { ReplyAiError } from "@modules/engine/domain/ports/reply-ai";
import { CAPTION_LIMITS } from "@modules/social/domain/post.rules";
import { AppConfig, appUrl } from "@shared/config/app-config";
import { DomainError, ValidationError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";
import { CryptoService } from "@shared/security/crypto.service";

import {
  brandSlideSvg,
  slideHeadlines,
  svgFormatFor,
} from "../domain/brand-template";
import {
  SOCIAL_API,
  SocialApi,
  SocialCredentials,
} from "../domain/ports/social-api";
import { decidePost } from "../domain/safeguards";
import {
  AutopostSettings,
  BrandKit,
  CONTENT_LABELS,
  ContentType,
  INSTAGRAM_POSTS_PER_DAY,
  MediaItem,
  PostContent,
  PostFormat,
  PostMode,
  SocialPlatform,
  checkPost,
  fullCaption,
  normalizeAutopostSettings,
  normalizeBrandKit,
} from "../domain/social.types";
import { addDays, localParts, weekStartOf, zonedTime } from "../domain/time";
import { SocialEngineRepository } from "../infrastructure/social-engine.repository";
import {
  SocialAccountRow,
  SocialAutopostRow,
} from "../infrastructure/social-engine.tables";

export interface SocialActor {
  userId: string | null;
  workspaceId: string;
  via: string;
}

const DAY = 86_400_000;
const RETRYABLE = new Set<string>([
  ErrorCode.META_UNAVAILABLE,
  ErrorCode.META_THROTTLED,
]);
const MAX_ATTEMPTS = 3;

export const PRODUCT_PATH: Record<SocialPlatform, string> = {
  instagram: "/instagram",
  facebook: "/facebook",
};

export function contentOf(row: SocialAutopostRow): PostContent {
  return {
    caption: row.caption,
    hashtags: row.hashtags,
    firstComment: row.firstComment,
    altText: row.altText,
    media: row.media,
    link: row.link,
    location: row.location,
    collaborators: row.collaborators,
  };
}

@Injectable()
export class SocialEngine {
  private readonly logger = new Logger(SocialEngine.name);

  constructor(
    readonly repo: SocialEngineRepository,
    @Inject(SOCIAL_API) readonly api: SocialApi,
    @Inject(POST_AI) private readonly postAi: PostAi,
    readonly workspaceAi: WorkspaceAiService,
    private readonly creatives: CreativesService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(ConfigService) readonly config: AppConfig,
  ) {
    workspaceAi.registerDraftCounter("social", (workspaceId, since) =>
      repo.aiDraftsSince(workspaceId, since),
    );
  }

  record(
    actor: SocialActor,
    action: string,
    target: string,
    data: Record<string, unknown> = {},
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: actor.userId ? "user" : "system",
      actorId: actor.userId,
      action: `autopost.${action}`,
      target,
      data: { ...data, via: actor.via },
    });
  }

  url(platform: SocialPlatform, path = "") {
    return `${appUrl(this.config)}${PRODUCT_PATH[platform]}${path}`;
  }

  settingsOf(account: SocialAccountRow): AutopostSettings {
    return normalizeAutopostSettings(account.platform, account.settings);
  }

  encrypt(token: string) {
    return this.crypto.encrypt(token);
  }

  creds(account: SocialAccountRow): SocialCredentials {
    return {
      login: account.login,
      platform: account.platform,
      externalId: account.externalId,
      pageId: account.pageId,
      token: this.crypto.decrypt(account.tokenCiphertext),
    };
  }

  usable(account: SocialAccountRow): SocialCredentials {
    if (account.status !== "active")
      throw new ValidationError(
        account.error ?? "Connect this account again to continue.",
      );
    return this.creds(account);
  }

  isAuthError(err: unknown) {
    return (
      err instanceof DomainError && err.code === ErrorCode.META_TOKEN_INVALID
    );
  }

  message(err: unknown, fallback: string) {
    return err instanceof DomainError ? err.message : fallback;
  }

  async failAccount(account: SocialAccountRow, err: unknown) {
    if (!this.isAuthError(err)) return;
    const via = account.login === "facebook" ? "Facebook" : "Instagram";
    await this.repo.updateAccount(account.id, {
      status: "error",
      error: `Your ${via} sign-in expired or was revoked. Connect again to keep posting.`,
    });
  }

  pauseNote(account: SocialAccountRow, now = new Date()): string | null {
    return account.pausedUntil && account.pausedUntil > now
      ? (account.pauseReason ??
          "Automatic posting is paused by the safety pause.")
      : null;
  }

  async brandFor(workspaceId: string, account: SocialAccountRow | null) {
    const own = account
      ? await this.repo.brandKit(workspaceId, account.id)
      : null;
    const shared = own ? null : await this.repo.brandKit(workspaceId, null);
    const kit = normalizeBrandKit(own?.kit ?? shared?.kit);
    if (!kit.name && account) kit.name = account.name;
    return kit;
  }

  async aiKey(workspaceId: string) {
    const ws = await this.workspaceAi.settings(workspaceId);
    const key = this.workspaceAi.keyFrom(ws);
    if (!key) return { key: null, allowance: 0, ws };
    return {
      key,
      allowance: await this.workspaceAi.allowance(workspaceId, ws),
      ws,
    };
  }

  async write(
    platform: SocialPlatform,
    brand: BrandKit,
    input: {
      format: PostFormat;
      contentType: ContentType;
      idea: string;
      avoid?: string | null;
    },
    key: string | null,
  ): Promise<PostAiResult & { ai: boolean }> {
    const request = {
      platform,
      format: input.format,
      contentType: input.contentType,
      idea: input.idea,
      avoid: input.avoid ?? null,
      maxLength: platform === "instagram" ? 1800 : 2000,
      brand: {
        name: brand.name,
        businessType: brand.businessType,
        audience: brand.audience,
        voice: brand.voice,
        topics: brand.topics,
        offers: brand.offers,
        hashtags: brand.hashtagSets.flatMap((s) => s.tags),
        bannedWords: brand.bannedWords,
        cta: brand.cta,
        link: brand.link,
        city: brand.city,
        language: brand.language,
      },
    };
    if (key)
      try {
        return { ...(await this.postAi.write(key, request)), ai: true };
      } catch (err) {
        if (!(err instanceof ReplyAiError)) throw err;
        this.logger.warn(`AI caption failed: ${err.message}`);
      }
    return { ...draftPost(request), ai: false };
  }

  async visuals(
    actor: SocialActor,
    brand: BrandKit,
    format: PostFormat,
    contentType: ContentType,
    headline: string,
    caption: string,
  ): Promise<MediaItem[]> {
    const slides =
      format === "carousel" || format === "multi_image"
        ? 3
        : format === "image" || format === "story"
          ? 1
          : 0;
    if (!slides) return [];
    const svgFormat = svgFormatFor(format);
    const headlines = slideHeadlines(headline, caption, brand.cta, slides);
    const out: MediaItem[] = [];
    for (const [i, text] of headlines.entries()) {
      const creative = await this.creatives.fromSvg(actor, {
        name: `${brand.name || "Post"} · ${CONTENT_LABELS[contentType]}${slides > 1 ? ` ${i + 1}` : ""}`,
        format: svgFormat,
        svg: brandSlideSvg({
          headline: text,
          kicker: CONTENT_LABELS[contentType],
          footer: [brand.name, brand.cta].filter(Boolean).join(" · "),
          kit: brand,
          format: svgFormat,
          slide: i,
          slides,
        }),
      });
      out.push({
        url: creative.url,
        kind: "image",
        creativeId: creative.id,
        width: creative.width,
        height: creative.height,
        durationSeconds: null,
      });
    }
    return out;
  }

  async decide(
    account: SocialAccountRow,
    input: {
      mode: PostMode;
      platform: SocialPlatform;
      format: PostFormat;
      content: PostContent;
      scheduledAt: Date;
      exceptId?: string;
    },
  ) {
    const settings = this.settingsOf(account);
    const local = localParts(input.scheduledAt, settings.timezone);
    const dayStart = zonedTime(local.day, 0, 0, settings.timezone);
    const dayEnd = zonedTime(addDays(local.day, 1), 0, 0, settings.timezone);
    const week = weekStartOf(input.scheduledAt, settings.timezone);
    const weekStart = zonedTime(week, 0, 0, settings.timezone);
    const weekEnd = zonedTime(addDays(week, 7), 0, 0, settings.timezone);
    const [sameDay, sameWeek] =
      input.mode === "auto"
        ? await Promise.all([
            this.repo.countPosts(account.id, dayStart, dayEnd, input.exceptId),
            this.repo.countPosts(
              account.id,
              weekStart,
              weekEnd,
              input.exceptId,
            ),
          ])
        : [0, 0];
    const brand = await this.brandFor(account.workspaceId, account);
    const text = fullCaption(input.content);
    const banned = brand.bannedWords.find(
      (w) => w.trim() && text.toLowerCase().includes(w.trim().toLowerCase()),
    );
    return decidePost({
      mode: input.mode,
      text,
      scheduledAt: input.scheduledAt,
      settings,
      sameDay,
      sameWeek,
      pausedBecause: this.pauseNote(account),
      problems: [
        ...checkPost(input.platform, input.format, input.content),
        ...(banned ? [`Uses the banned word "${banned}".`] : []),
      ],
    });
  }

  async publish(post: SocialAutopostRow, actor: SocialActor) {
    const account = await this.repo.accountById(post.accountId);
    const fail = async (message: string) => {
      const row = await this.repo.updatePost(post.id, {
        status: "failed",
        error: message,
      });
      await this.record(actor, "post_failed", post.id, { error: message });
      return row;
    };
    if (!account) return fail("This account is no longer connected.");
    if (
      post.mode === "auto" &&
      !post.approvedBy &&
      actor.via === "schedule" &&
      this.pauseNote(account)
    )
      return this.repo.updatePost(post.id, {
        status: "pending_approval",
        heldReason: this.pauseNote(account),
      });
    const problems = checkPost(post.platform, post.format, contentOf(post));
    if (problems.length) return fail(problems.join(" "));
    if (
      post.platform === "instagram" &&
      (await this.repo.publishedCount(
        account.id,
        new Date(Date.now() - DAY),
      )) >= INSTAGRAM_POSTS_PER_DAY
    )
      return fail(
        `Instagram allows ${INSTAGRAM_POSTS_PER_DAY} posts through the API in 24 hours. Try again later.`,
      );
    let creds: SocialCredentials;
    try {
      creds = this.usable(account);
    } catch (err) {
      return fail(this.message(err, "Connect this account again."));
    }
    const caption = fullCaption(contentOf(post)).slice(
      0,
      CAPTION_LIMITS[post.platform],
    );
    try {
      const result = await this.api.publish(creds, {
        format: post.format,
        caption,
        media: post.media,
        link: post.link,
        location: post.location,
        collaborators: post.collaborators,
        altText: post.altText,
      });
      let firstCommentId: string | null = null;
      if (post.firstComment && post.format !== "story")
        try {
          firstCommentId = (
            await this.api.comment(creds, result.id, post.firstComment)
          ).id;
        } catch (err) {
          this.logger.warn(
            `First comment failed for ${post.id}: ${(err as Error).message}`,
          );
        }
      const row = await this.repo.updatePost(post.id, {
        status: "published",
        publishedAt: new Date(),
        externalId: result.id,
        permalink: result.permalink,
        firstCommentId,
        error: null,
        heldReason: null,
        attempts: post.attempts + 1,
      });
      await this.record(actor, "post_published", post.id, {
        account: account.id,
        platform: post.platform,
        format: post.format,
      });
      return row;
    } catch (err) {
      await this.failAccount(account, err);
      const message = this.message(err, "The post couldn't be published.");
      if (
        err instanceof DomainError &&
        RETRYABLE.has(err.code) &&
        post.attempts + 1 < MAX_ATTEMPTS
      )
        return this.repo.updatePost(post.id, {
          status: "scheduled",
          scheduledAt: new Date(Date.now() + 5 * 60_000 * (post.attempts + 1)),
          attempts: post.attempts + 1,
          error: message,
        });
      if (!(err instanceof DomainError))
        this.logger.error(
          "Publishing failed",
          err instanceof Error ? err.stack : String(err),
        );
      await this.repo.updatePost(post.id, { attempts: post.attempts + 1 });
      return fail(message);
    }
  }

  async publishDue(limit = 20) {
    const due = await this.repo.claimDue(new Date(), limit);
    let published = 0;
    let failed = 0;
    for (const post of due) {
      const row = await this.publish(post, {
        userId: null,
        workspaceId: post.workspaceId,
        via: "schedule",
      });
      if (row.status === "published") published++;
      else if (row.status === "failed") failed++;
    }
    return { due: due.length, published, failed };
  }

  async refreshTokens(limit = 20) {
    let refreshed = 0;
    for (const account of await this.repo.accountsExpiring(
      new Date(Date.now() + 10 * DAY),
      limit,
    )) {
      try {
        const next = await this.api.refresh(
          account.login,
          this.creds(account).token,
        );
        await this.repo.updateAccount(account.id, {
          tokenCiphertext: this.encrypt(next.token),
          tokenExpiresAt: next.expiresAt,
        });
        refreshed++;
      } catch (err) {
        await this.failAccount(account, err);
        if (
          !this.isAuthError(err) &&
          account.tokenExpiresAt &&
          account.tokenExpiresAt < new Date()
        )
          await this.repo.updateAccount(account.id, {
            status: "error",
            error: "The sign-in expired. Connect again to keep posting.",
          });
        this.logger.warn(
          `Token refresh failed for ${account.name}: ${(err as Error).message}`,
        );
      }
    }
    return refreshed;
  }

  async importHistory(account: SocialAccountRow) {
    const remote = await this.api.recentPosts(this.creds(account), 30);
    const rows = await this.repo.insertPosts(
      remote.map((p) => ({
        workspaceId: account.workspaceId,
        accountId: account.id,
        platform: account.platform,
        format: p.format,
        contentType: "announcement" as const,
        caption: p.caption,
        media: p.mediaUrl
          ? [
              {
                url: p.mediaUrl,
                kind: "image" as const,
                creativeId: null,
                width: null,
                height: null,
                durationSeconds: null,
              },
            ]
          : [],
        status: "published" as const,
        mode: "manual" as const,
        publishedAt: p.createdAt,
        externalId: p.id,
        permalink: p.permalink,
        source: "imported",
      })),
    );
    return { posts: rows.length, captions: remote.map((p) => p.caption) };
  }
}
