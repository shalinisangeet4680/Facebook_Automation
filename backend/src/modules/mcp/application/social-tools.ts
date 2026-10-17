import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { SocialAccountsService } from "@modules/social-engine/application/social-accounts.service";
import { SocialCommentsService } from "@modules/social-engine/application/social-comments.service";
import {
  BrandKitPatch,
  SocialContentService,
} from "@modules/social-engine/application/social-content.service";
import {
  PRODUCT_PATH,
  SocialActor,
} from "@modules/social-engine/application/social-engine.service";
import { SocialInsightsService } from "@modules/social-engine/application/social-insights.service";
import {
  COMMENT_CLASSES,
  CONTENT_TYPES,
  POST_FORMATS,
  SOCIAL_PLATFORMS,
  SocialPlatform,
  VOICES,
} from "@modules/social-engine/domain/social.types";
import { AppConfig, appUrl } from "@shared/config/app-config";

type Confirmed = (
  tool: string,
  args: Record<string, unknown>,
  token: string | undefined,
  preview: () => Promise<{ changes: string[]; enablesAuto: boolean }>,
  apply: () => Promise<unknown>,
) => Promise<unknown>;

export interface SocialToolDeps {
  accounts: SocialAccountsService;
  content: SocialContentService;
  comments: SocialCommentsService;
  insights: SocialInsightsService;
  workspaceAi: WorkspaceAiService;
  config: AppConfig;
}

export const SOCIAL_INSTRUCTIONS =
  "- Instagram Autopost and Facebook Autopost: list_social_accounts first (each Page or Instagram account has an id). get_brand_kit holds the owner's voice, audience, topics, offers, hashtags, banned words and call to action; follow it in every caption and never use a banned word. plan_social_week fills a week of the calendar at the account's best times with captions and brand-template images; posts wait for approval unless the owner set a content type to auto. list_social_calendar shows what is planned. create_social_post saves a draft or a post for approval straight away; publishing now or scheduling is two-step: show the caption, format and time, wait for an explicit yes, call again with confirm_token. Instagram captions: up to 2,200 characters and 30 hashtags; put hashtags in hashtags, not in the caption. get_social_insights explains reach, engagement, follower growth and the best time to post. list_social_comments shows comments by class (question, praise, complaint, spam); reply_to_social_comment posts a public reply and is two-step, and when the owner hasn't allowed agents to post it saves the reply for approval instead. update_brand_kit is two-step.";

const platform = z.enum(SOCIAL_PLATFORMS);
const accountId = z
  .string()
  .uuid()
  .describe("An account id from list_social_accounts");

export function registerSocialReadTools(
  server: McpServer,
  ws: string,
  run: (fn: () => Promise<unknown>) => Promise<CallToolResult>,
  deps: SocialToolDeps,
) {
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const url = (p: SocialPlatform, path = "") =>
    `${appUrl(deps.config)}${PRODUCT_PATH[p]}${path}`;

  server.registerTool(
    "list_social_accounts",
    {
      title: "Instagram and Facebook accounts",
      description:
        "Facebook Pages and Instagram professional accounts connected to Instagram Autopost and Facebook Autopost, with followers, connection health, posts waiting for approval, scheduled posts, open comments and any safety pause.",
      inputSchema: { platform: platform.optional() },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const accounts = await deps.accounts.accounts(ws, a.platform);
        return {
          accounts: accounts.data,
          connect_url: url(a.platform ?? "instagram", "/accounts"),
        };
      }),
  );

  server.registerTool(
    "get_brand_kit",
    {
      title: "Brand kit",
      description:
        "The brand kit used for captions and images: business type, audience, voice, topics, offers and products, hashtag sets, banned words, colours, fonts, call to action and link. Pass account_id for an account's own kit; otherwise the workspace kit.",
      inputSchema: { account_id: accountId.optional() },
      annotations: readOnly,
    },
    (a) => run(() => deps.content.brandKit(ws, a.account_id)),
  );

  server.registerTool(
    "list_social_calendar",
    {
      title: "Social calendar",
      description:
        "Posts planned, waiting for approval, scheduled and published for Instagram or Facebook between from and to (ISO date-times; default the next 14 days), with format, caption, hashtags, media, status and time, plus the weekly plans.",
      inputSchema: {
        platform,
        account_id: accountId.optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const from = a.from ?? new Date().toISOString();
        const to =
          a.to ??
          new Date(new Date(from).getTime() + 14 * 86_400_000).toISOString();
        const calendar = await deps.content.calendar(ws, {
          platform: a.platform,
          accountId: a.account_id,
          from,
          to,
        });
        return {
          plans: calendar.plans,
          posts: calendar.data.map((p) => ({
            post_id: p.id,
            account_id: p.accountId,
            account: p.accountName,
            format: p.format,
            content_type: p.contentType,
            status: p.status,
            mode: p.mode,
            scheduled_at: p.scheduledAt,
            published_at: p.publishedAt,
            caption: p.caption,
            hashtags: p.hashtags,
            media: p.media.map((m) => m.url),
            held_reason: p.heldReason,
            problems: p.problems,
          })),
          url: url(a.platform),
        };
      }),
  );

  server.registerTool(
    "get_social_insights",
    {
      title: "Instagram or Facebook insights",
      description:
        "Reach, impressions, likes, comments, shares, saves and video plays for posts published in the last 7, 30 or 90 days compared with the period before, follower growth, profile visits, top posts, results by format and content type, comment reply rate, the best time to post and recommendations.",
      inputSchema: {
        platform,
        account_id: accountId.optional(),
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const i = await deps.insights.insights(ws, {
          platform: a.platform,
          accountId: a.account_id,
          days: a.days,
        });
        return {
          current: i.current,
          previous: i.previous,
          followers: i.followers,
          profile_visits: i.profileVisits,
          top_posts: i.topPosts,
          by_format: i.byFormat,
          by_content_type: i.byContentType,
          best_times: i.bestTimes.slots.slice(0, 5),
          best_times_source: i.bestTimes.source,
          comments: i.comments,
          recommendations: i.recommendations,
          url: url(a.platform, "/insights"),
        };
      }),
  );

  server.registerTool(
    "list_social_comments",
    {
      title: "Instagram and Facebook comments",
      description:
        "Comments on the account's posts. filter open (default) holds comments without a reply, replied the answered ones. Each has its class (question, praise, complaint, spam, other), any draft reply waiting for approval and the comment id for reply_to_social_comment.",
      inputSchema: {
        platform: platform.optional(),
        account_id: accountId.optional(),
        filter: z.enum(["open", "replied", "all"]).default("open"),
        classes: z.array(z.enum(COMMENT_CLASSES)).max(5).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const list = await deps.comments.list(ws, {
          platform: a.platform,
          accountId: a.account_id,
          filter: a.filter,
          classes: a.classes,
          limit: a.limit,
        });
        return {
          counts: list.counts,
          comments: list.data.map((c) => ({
            comment_id: c.id,
            account_id: c.accountId,
            platform: c.platform,
            author: c.author,
            text: c.text,
            class: c.class,
            state: c.state,
            commented_at: c.commentedAt,
            post: c.postCaption,
            reply: c.reply?.text ?? null,
            draft: c.draft
              ? { text: c.draft.text, status: c.draft.status }
              : null,
          })),
          url: url(a.platform ?? "instagram", "/comments"),
        };
      }),
  );
}

export function registerSocialWriteTools(
  server: McpServer,
  ws: string,
  actor: SocialActor,
  run: (fn: () => Promise<unknown>) => Promise<CallToolResult>,
  confirmed: Confirmed,
  deps: SocialToolDeps,
) {
  const url = (p: SocialPlatform, path = "") =>
    `${appUrl(deps.config)}${PRODUCT_PATH[p]}${path}`;
  const isoTime = z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Use an ISO date-time");

  server.registerTool(
    "update_brand_kit",
    {
      title: "Change the brand kit (needs confirmation)",
      description:
        "Change the brand kit used for captions and images. Only send what changes; lists replace the current list. Pass account_id to change that account's own kit (it starts from the workspace kit). Two steps: call without confirm_token to get a summary, show it to the user, then call again with the same arguments and confirm_token after they agree.",
      inputSchema: {
        account_id: accountId.optional(),
        name: z.string().max(100).optional(),
        business_type: z.string().max(100).optional(),
        audience: z.string().max(300).optional(),
        voice: z.enum(VOICES).optional(),
        topics: z.array(z.string().max(100)).max(20).optional(),
        offers: z.array(z.string().max(200)).max(20).optional(),
        hashtag_sets: z
          .array(
            z.object({
              name: z.string().max(40),
              tags: z.array(z.string().max(60)).max(30),
            }),
          )
          .max(10)
          .optional(),
        banned_words: z.array(z.string().max(60)).max(100).optional(),
        cta: z.string().max(80).optional(),
        link: z.string().url().nullable().optional(),
        website_url: z.string().url().nullable().optional(),
        city: z.string().max(80).nullable().optional(),
        colors: z
          .object({
            primary: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .optional(),
            secondary: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .optional(),
            accent: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .optional(),
          })
          .optional(),
        confirm_token: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ confirm_token, account_id, ...a }) =>
      run(() => {
        const patch: BrandKitPatch = Object.fromEntries(
          Object.entries({
            name: a.name,
            businessType: a.business_type,
            audience: a.audience,
            voice: a.voice,
            topics: a.topics,
            offers: a.offers,
            hashtagSets: a.hashtag_sets,
            bannedWords: a.banned_words,
            cta: a.cta,
            link: a.link,
            websiteUrl: a.website_url,
            city: a.city,
            colors: a.colors,
          }).filter(([, v]) => v !== undefined),
        );
        return confirmed(
          "update_brand_kit",
          { account_id, ...a },
          confirm_token,
          () => deps.content.previewBrandKit(ws, account_id ?? null, patch),
          () => deps.content.saveBrandKit(actor, account_id ?? null, patch),
        );
      }),
  );

  server.registerTool(
    "plan_social_week",
    {
      title: "Plan a week of posts",
      description:
        "Generate the weekly content plan for one account: a mix of tips, offers, behind the scenes, testimonials and Indian festivals, at the account's best times, each with a caption, hashtags, first comment, alt text and brand-template images. week_start is a Monday (YYYY-MM-DD); default is this week, or next week from Thursday. Planning the same week again replaces its unpublished posts. Posts follow the owner's mode per content type (approval by default), so nothing goes out unless the owner chose auto.",
      inputSchema: {
        account_id: accountId,
        week_start: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (a) =>
      run(async () => {
        const result = await deps.content.generatePlan(actor, {
          accountId: a.account_id,
          weekStart: a.week_start,
        });
        const account = await deps.accounts.account(ws, a.account_id);
        return {
          plan: result.plan,
          posts: result.posts.map((p) => ({
            post_id: p.id,
            format: p.format,
            content_type: p.contentType,
            status: p.status,
            scheduled_at: p.scheduledAt,
            caption: p.caption,
            held_reason: p.heldReason,
          })),
          url: url(account.platform),
        };
      }),
  );

  server.registerTool(
    "create_social_post",
    {
      title: "Create an Instagram or Facebook post",
      description:
        "Create a post for one account. Instagram formats: image, carousel (2–10 items), reel (one video), story (one image or video). Facebook formats: image, multi_image (2–10 images), video, text, link. media items are creative_id values from list_creatives or save_ad_creative, or public https urls. Set generate_image to render a brand-template image instead. Put hashtags in hashtags. when: draft (saved), approval (waits for the owner at the next best time unless scheduled_at), schedule (scheduled_at, 2 minutes to 60 days ahead) or now. draft and approval are saved straight away; schedule and now are two-step: show the summary, wait for an explicit yes, call again with confirm_token.",
      inputSchema: {
        account_id: accountId,
        format: z.enum(POST_FORMATS),
        content_type: z.enum(CONTENT_TYPES).default("announcement"),
        caption: z.string().max(5000).default(""),
        hashtags: z.array(z.string().max(100)).max(30).optional(),
        first_comment: z.string().max(2200).optional(),
        alt_text: z.string().max(1000).optional(),
        media: z
          .array(
            z.object({
              creative_id: z.string().uuid().optional(),
              url: z.string().url().optional(),
              kind: z.enum(["image", "video"]).optional(),
            }),
          )
          .max(10)
          .optional(),
        generate_image: z.boolean().default(false),
        idea: z.string().max(500).optional(),
        link: z.string().url().optional(),
        when: z
          .enum(["draft", "approval", "schedule", "now"])
          .default("approval"),
        scheduled_at: isoTime.optional(),
        confirm_token: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ confirm_token, ...a }) =>
      run(async () => {
        const input = {
          accountId: a.account_id,
          format: a.format,
          contentType: a.content_type,
          caption: a.caption,
          hashtags: a.hashtags,
          firstComment: a.first_comment ?? null,
          altText: a.alt_text ?? null,
          media: a.media?.map((m) => ({
            creativeId: m.creative_id,
            url: m.url,
            kind: m.kind,
          })),
          generateImage: a.generate_image,
          idea: a.idea ?? (a.caption.split(/[.!?\n]/)[0] || null),
          link: a.link ?? null,
          when: a.when,
          scheduledAt: a.scheduled_at ?? null,
        };
        const account = await deps.accounts.account(ws, a.account_id);
        if (a.when === "draft" || a.when === "approval") {
          const post = await deps.content.createPost(actor, input);
          return {
            status: "saved",
            post,
            url: url(account.platform, "/posts"),
          };
        }
        const { problems } = await deps.content.check(actor, input);
        if (problems.length && !a.generate_image)
          return { status: "invalid", problems };
        return confirmed(
          "create_social_post",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                `${a.when === "now" ? "Publish now" : `Schedule for ${a.scheduled_at}`} on ${account.platform === "instagram" ? "Instagram" : "Facebook"} (${account.username ?? account.name}): ${a.format.replace("_", " ")} post "${a.caption}"${a.hashtags?.length ? ` with ${a.hashtags.length} hashtags` : ""}${a.media?.length ? ` and ${a.media.length} media item${a.media.length === 1 ? "" : "s"}` : a.generate_image ? " and a brand-template image" : ""}`,
              ],
              enablesAuto: false,
            }),
          () => deps.content.createPost(actor, input),
        );
      }),
  );

  server.registerTool(
    "reply_to_social_comment",
    {
      title: "Reply to a comment (needs confirmation)",
      description:
        "Post a public reply to an Instagram or Facebook comment as the business. Two steps: call without confirm_token to get a summary, show the reply to the user, then call again with the same arguments and confirm_token after they explicitly agree. If the owner hasn't allowed agents to post, the reply is saved for the owner's approval instead.",
      inputSchema: {
        comment_id: z.string().uuid(),
        text: z.string().min(1).max(2200),
        confirm_token: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ confirm_token, ...a }) =>
      run(async () => {
        const comment = await deps.comments.view(ws, a.comment_id);
        const settings = await deps.workspaceAi.settings(ws);
        if (!settings?.agentsCanPost) {
          const saved = await deps.comments.saveDraft(actor, a.comment_id, {
            text: a.text,
            source: "claude",
          });
          return {
            status: "saved_for_approval",
            message:
              'The owner hasn\'t allowed agents to post replies, so the reply waits for their approval in TreeVook. They can turn on "Allow agents to post replies" to let you post directly.',
            comment: { comment_id: saved.id, state: saved.state },
            url: url(comment.platform, "/comments"),
          };
        }
        return confirmed(
          "reply_to_social_comment",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                `Reply publicly to ${comment.author || "a follower"}'s ${comment.platform === "instagram" ? "Instagram" : "Facebook"} comment "${comment.text.slice(0, 120)}": "${a.text}"`,
              ],
              enablesAuto: false,
            }),
          () =>
            deps.comments.replyNow(actor, a.comment_id, {
              text: a.text,
              source: "claude",
            }),
        );
      }),
  );
}
