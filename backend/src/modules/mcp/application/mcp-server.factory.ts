import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { AdsService } from "@modules/ads/application/ads.service";
import {
  CONFIRM_TTL_SECONDS,
  ConfirmationService,
} from "@modules/ads/application/confirmation.service";
import { AdsActor } from "@modules/ads/domain/ads.types";
import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOAL_NAMES,
} from "@modules/ads/domain/goals";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import { SVG_FORMATS } from "@modules/creatives/domain/creative.rules";
import { SCOPES } from "@modules/oauth/domain/oauth.policy";
import { PlanService } from "@modules/plans/application/plan.service";
import { planSchema } from "@modules/plans/domain/plan.schema";
import { SocialService } from "@modules/social/application/social.service";
import {
  PlayService,
  REVIEW_STATES,
} from "@modules/play/application/play.service";
import { PlayInboxService } from "@modules/play/application/play-inbox.service";
import { PlayWorkspaceService } from "@modules/play/application/play-workspace.service";
import { PlayAgentService } from "@modules/play/application/play-agent.service";
import { PlayReleasesService } from "@modules/play-releases/application/play-releases.service";
import { StoreService } from "@modules/store/application/store.service";
import { BusinessReviewsService } from "@modules/business/application/business-reviews.service";
import { BusinessService } from "@modules/business/application/business.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { AppConfig } from "@shared/config/app-config";
import { LANG, SLUG } from "@modules/store/domain/store.rules";
import { InboxService } from "@modules/inbox/application/inbox.service";
import { ProfileService } from "@modules/profile/application/profile.service";
import { FACEBOOK_PARTS } from "@modules/profile/domain/profile.draft";
import { DomainError, ValidationError } from "@shared/errors/domain-error";
import { McpAuth } from "@shared/security/jwt-claims";

import {
  BUSINESS_INSTRUCTIONS,
  registerBusinessReadTools,
  registerBusinessWriteTools,
} from "./business-tools";
import {
  RELEASES_INSTRUCTIONS,
  registerPlayReleasesReadTools,
  registerPlayReleasesWriteTools,
} from "./play-releases-tools";

const INSTRUCTIONS = `TreeVook AI is one platform for the user's business automations: Meta (Facebook and Instagram) ads, Google Play store listings and review replies, and Google Business Profile.

How to work:
- Start with get_account_overview to learn the ad account, currency, Page, Pixel and guardrails.
- Use get_performance for numbers. Money is in the account currency (major units, e.g. rupees). Explain results in plain language and suggest concrete next steps.
- create_campaign_draft builds the campaign, ad set and ad in Meta, all PAUSED. Nothing spends money until it is activated.
- activate and update_daily_budget are two-step. The first call returns a summary and a confirm_token. Show the summary to the user, wait for an explicit yes in this conversation, then call again with the same arguments plus confirm_token. Never confirm on the user's behalf.
- pause takes effect immediately and is always safe.
- Use search_targeting to find city, region and interest keys before drafting.
- To plan a new campaign: call get_planning_context, research the business (ask the user, read their website), then call propose_campaign_plan with every setting and a clear reason for each choice. Share the returned review link. The owner reviews, edits, creates and launches the plan in TreeVook; do not call create_campaign_draft for a proposed plan unless the user asks.
- To design an ad image: write a self-contained SVG (inline shapes, text and data-URI images only; no scripts or external links) with the viewBox of the chosen format, show it to the user, iterate, then call save_ad_creative. The returned url can be used as imageUrl in a plan. Keep text on images short and legible.
- To post organically: save or pick a creative, write a Facebook caption and an Instagram caption (shorter, with a few relevant hashtags), then call publish_post. It is two-step like activate: show the summary, wait for the user's yes, call again with confirm_token. Published posts can later be used as ads.
- To set up the Facebook Page and Instagram profile: call get_profile_checkup, write the Page description and Instagram bio (150 characters max), design a logo (format logo) and Facebook cover (format facebook_cover) with save_ad_creative, then save everything with save_profile_draft. The owner applies Facebook changes in TreeVook or through apply_facebook_profile with confirmation. Instagram's API can't edit profiles, so tell the user to copy the bio and logo from TreeVook's Profile page into the Instagram app.
- Google Play store listing images are made by the store-creatives Claude Code plugin on the user's machine. With the plugin: call store_save_project with the app name and languages, pass the returned upload_url and upload_token to the plugin's upload_to_platform tool, and share the returned url so the owner can choose a style, languages and sizes in TreeVook. Read the choice with store_get_project, render that set with the plugin and upload it the same way. Upload tokens last two hours; get a fresh one with store_start_upload.
- Google Play review replies: list_play_apps, then list_play_reviews (state "claude" holds reviews the owner's rules sent to you; "unreplied" and "waiting" are the rest). Read get_review_templates for the owner's tone, sign-off and support details (values), and write each reply in the reviewer's language, at most 350 characters, plain text, specific to what they said, never promising refunds or fixes you can't confirm. Save drafts with save_review_drafts so the owner approves them in TreeVook, and share the returned url. send_review_reply posts publicly and is two-step like activate: show the reply, wait for an explicit yes, call again with confirm_token. Use get_review_insights to explain rating trends and common complaints. To change how an app replies, read get_review_settings first, then use update_review_settings (per-rating mode and template, behavior, safeguards, placeholders), set_review_rules (advanced keyword rules) or update_review_workspace (AI drafting mode, Slack channel); each is two-step: show the summary, wait for an explicit yes, call again with confirm_token. sync_play_apps fetches new reviews and newly shared apps; import_review_history pulls older months.
${RELEASES_INSTRUCTIONS}
${BUSINESS_INSTRUCTIONS}
- Ads must follow Meta advertising policies. Never make health claims that promise cures or outcomes.`;

const DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
  "maximum",
] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const id = z.string().regex(/^\d{5,30}$/, "Use the numeric Meta id");

@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);

  constructor(
    private readonly ads: AdsService,
    private readonly plans: PlanService,
    private readonly creatives: CreativesService,
    private readonly social: SocialService,
    private readonly confirmations: ConfirmationService,
    private readonly inbox: InboxService,
    private readonly profile: ProfileService,
    private readonly store: StoreService,
    private readonly play: PlayService,
    private readonly playInbox: PlayInboxService,
    private readonly playWorkspace: PlayWorkspaceService,
    private readonly playAgent: PlayAgentService,
    private readonly business: BusinessService,
    private readonly businessReviews: BusinessReviewsService,
    private readonly workspaceAi: WorkspaceAiService,
    private readonly playReleases: PlayReleasesService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  create(auth: McpAuth, clientName: string): McpServer {
    const server = new McpServer(
      { name: "treevook", title: "TreeVook AI", version: "1.0.0" },
      { instructions: INSTRUCTIONS, capabilities: { tools: {} } },
    );
    const ws = auth.workspaceId;
    const actor: AdsActor = {
      userId: auth.userId,
      workspaceId: ws,
      via: `mcp:${clientName}`,
    };
    const run = (fn: () => Promise<unknown>) => this.run(fn);
    const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

    server.registerTool(
      "get_account_overview",
      {
        title: "Account overview",
        description:
          "The connected Meta business, ad account (currency, time zone, status, amount spent, spend cap), Facebook Page, Instagram account, Pixel, connection health and guardrails.",
        annotations: readOnly,
      },
      () => run(() => this.ads.overview(ws)),
    );

    server.registerTool(
      "get_performance",
      {
        title: "Ad performance",
        description:
          "Meta Insights for the ad account, by account, campaign, ad set or ad. Returns spend, impressions, reach, frequency, link clicks, CTR, CPC, CPM, the main result for the objective and cost per result. Use a preset or since/until (YYYY-MM-DD, account time zone). Set daily for one row per day.",
        inputSchema: {
          level: z
            .enum(["account", "campaign", "adset", "ad"])
            .default("campaign"),
          date_preset: z.enum(DATE_PRESETS).optional(),
          since: date.optional(),
          until: date.optional(),
          daily: z.boolean().optional(),
          campaign_id: id.optional(),
          limit: z.number().int().min(1).max(200).optional(),
        },
        annotations: readOnly,
      },
      (a) =>
        run(() =>
          this.ads.performance(ws, {
            level: a.level,
            datePreset: a.date_preset,
            since: a.since,
            until: a.until,
            daily: a.daily,
            campaignId: a.campaign_id,
            limit: a.limit,
          }),
        ),
    );

    server.registerTool(
      "list_campaigns",
      {
        title: "List campaigns",
        description:
          "Campaigns in the ad account with objective, status, delivery status, budgets and dates.",
        inputSchema: {
          status: z.enum(["active", "paused", "all"]).default("all"),
        },
        annotations: readOnly,
      },
      (a) => run(() => this.ads.campaigns(ws, a.status)),
    );

    server.registerTool(
      "get_campaign",
      {
        title: "Campaign details",
        description:
          "One campaign with its ad sets (targeting, optimisation goal, budget, status) and ads (text, headline, link, image, call to action, status), plus an Ads Manager link.",
        inputSchema: { campaign_id: id },
        annotations: readOnly,
      },
      (a) => run(() => this.ads.campaign(ws, a.campaign_id)),
    );

    server.registerTool(
      "check_tracking",
      {
        title: "Check Pixel tracking",
        description:
          "Pixel (dataset) health: last fire time and event counts for the last 24 hours and 7 days, with warnings when conversions are not being tracked.",
        annotations: readOnly,
      },
      () => run(() => this.ads.tracking(ws)),
    );

    server.registerTool(
      "search_targeting",
      {
        title: "Search targeting options",
        description:
          "Find Meta targeting keys for cities, regions, countries, interests, job titles (work_position), industries and behaviours (e.g. Small business owners). Plans put interests, job titles and industries in one OR group; behaviours are a second group people must also match.",
        inputSchema: {
          type: z.enum([
            "city",
            "region",
            "country",
            "interest",
            "work_position",
            "industry",
            "behavior",
          ]),
          query: z.string().min(2).max(100),
          country_code: z.string().length(2).optional(),
        },
        annotations: readOnly,
      },
      (a) =>
        run(() =>
          this.ads.searchTargeting(
            ws,
            a.type,
            a.query,
            a.country_code?.toUpperCase(),
          ),
        ),
    );

    server.registerTool(
      "get_planning_context",
      {
        title: "Planning context",
        description:
          "Everything needed to plan a new campaign: ad account, Page, Pixel and its recent events, past campaigns with 90-day results, guardrails and the allowed goals, conversion events and calls to action.",
        annotations: readOnly,
      },
      () => run(() => this.ads.planningContext(ws)),
    );

    server.registerTool(
      "list_campaign_plans",
      {
        title: "List campaign plans",
        description:
          "Campaign plans proposed so far with their status (draft, created, launched, discarded) and review links.",
        annotations: readOnly,
      },
      () =>
        run(async () => {
          const { data } = await this.plans.list(ws);
          return {
            plans: data.map((p) => ({
              ...p,
              reviewUrl: this.plans.reviewUrl(p.id),
            })),
          };
        }),
    );

    server.registerTool(
      "list_creatives",
      {
        title: "List creatives",
        description:
          "Images in the TreeVook creatives library with their public url, size and source.",
        annotations: readOnly,
      },
      () => run(() => this.creatives.list(ws)),
    );

    server.registerTool(
      "list_social_posts",
      {
        title: "List Page and Instagram posts",
        description:
          "Recent posts on the connected Facebook Page and Instagram account with likes and comments, plus posts scheduled or published through TreeVook.",
        annotations: readOnly,
      },
      () =>
        run(async () => {
          const [facebook, instagram, scheduled] = await Promise.all([
            this.social.library(ws, "facebook"),
            this.social.library(ws, "instagram"),
            this.social.list(ws),
          ]);
          return { facebook, instagram, autopilotPosts: scheduled.data };
        }),
    );

    server.registerTool(
      "get_suggestions",
      {
        title: "TreeVook suggestions",
        description:
          "Open suggestions from TreeVook's daily checks (ads to pause, ad sets to scale, creative fatigue, landing page drop-off, silent Pixel, budget pacing) with evidence, plus plans waiting for review and failed posts. Use refresh=true to re-run the checks now.",
        inputSchema: { refresh: z.boolean().default(false) },
        annotations: readOnly,
      },
      (a) =>
        run(async () => {
          if (a.refresh) await this.inbox.refresh(ws);
          return this.inbox.inbox(ws);
        }),
    );

    server.registerTool(
      "get_profile_checkup",
      {
        title: "Profile checkup",
        description:
          "Current Facebook Page and Instagram profile (picture, cover, description, bio, website, contact) with a checklist and score, plus the saved draft of proposed changes.",
        annotations: readOnly,
      },
      () => run(() => this.profile.checkup(ws)),
    );

    server.registerTool(
      "store_get_project",
      {
        title: "Store listing project",
        description:
          "A Google Play store listing project: status, the style, languages and sizes the owner chose in TreeVook, image counts, screen names and what to do next. Without project_id, lists all projects.",
        inputSchema: { project_id: z.string().uuid().optional() },
        annotations: readOnly,
      },
      (a) =>
        run(() =>
          a.project_id
            ? this.store.forClaude(ws, a.project_id)
            : this.store.list(ws),
        ),
    );

    const appId = z.string().uuid();

    server.registerTool(
      "list_play_apps",
      {
        title: "Google Play apps",
        description:
          "Google Play apps connected for review replies, with rating, rating trend, reviews needing a reply, replies waiting for approval and reviews waiting for Claude.",
        annotations: readOnly,
      },
      () => run(() => this.play.apps(ws)),
    );

    server.registerTool(
      "list_play_reviews",
      {
        title: "Google Play reviews",
        description:
          'Reviews of one app, newest first. state: "claude" (rules asked you to draft), "unreplied", "waiting" (draft waiting for the owner), "scheduled", "failed", "replied"; omit for all. Each review has its text, translation, language, version, current reply and draft.',
        inputSchema: {
          app_id: appId,
          state: z.enum(REVIEW_STATES as [string, ...string[]]).optional(),
          stars: z.array(z.number().int().min(1).max(5)).optional(),
          limit: z.number().int().min(1).max(50).default(20),
        },
        annotations: readOnly,
      },
      (a) =>
        run(() =>
          this.play.forClaude(
            ws,
            a.app_id,
            a.state as (typeof REVIEW_STATES)[number] | undefined,
            a.stars,
            a.limit,
          ),
        ),
    );

    server.registerTool(
      "get_review_templates",
      {
        title: "Reply templates and values",
        description:
          "The owner's reply templates (with wordings per language) and this app's values like team_name and support_email, to match their tone and include the right contact details.",
        inputSchema: { app_id: appId },
        annotations: readOnly,
      },
      (a) => run(() => this.play.templatesForClaude(ws, a.app_id)),
    );

    server.registerTool(
      "get_review_insights",
      {
        title: "Review insights",
        description:
          "Rating and review volume for a period against the period before, reply rate, median reply time, star distribution, rating by app version, languages, and the most common words in 1-2 star and 4-5 star reviews.",
        inputSchema: {
          app_id: appId,
          days: z
            .union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)])
            .default(30),
        },
        annotations: readOnly,
      },
      (a) => run(() => this.play.insights(ws, a.app_id, a.days)),
    );

    server.registerTool(
      "get_review_analytics",
      {
        title: "Review analytics across apps",
        description:
          "Reviews, reply rate, median response time and average rating for the last 7, 30 or 90 days, a from/to date range (YYYY-MM-DD, both required), or all time (all: true), against the period before, daily reviews vs replies, the rating mix and the topics reviewers mention most with their change. Omit app_id for all apps.",
        inputSchema: {
          app_id: appId.optional(),
          days: z
            .union([z.literal(7), z.literal(30), z.literal(90)])
            .default(30),
          from: date.optional(),
          to: date.optional(),
          all: z.boolean().optional(),
        },
        annotations: readOnly,
      },
      (a) =>
        run(() =>
          this.playInbox.analytics(ws, a.app_id, {
            days: a.days,
            from: a.from,
            to: a.to,
            all: a.all,
          }),
        ),
    );

    server.registerTool(
      "get_review_settings",
      {
        title: "Review reply settings for an app",
        description:
          "Everything the owner can set for one app: auto-reply on/off, mode and template per star rating, behavior (posting delay, voice, translate, personalize, skip star-only, escalate 1-star, safety pause, reply to edited), safeguards (time zone, quiet hours, daily automatic limit, never-auto words), placeholder values, advanced keyword rules, the templates to choose from, and workspace AI drafting and Slack status. Read this before proposing changes.",
        inputSchema: { app_id: appId },
        annotations: readOnly,
      },
      (a) => run(() => this.playAgent.settingsForClaude(ws, a.app_id)),
    );

    registerBusinessReadTools(server, ws, run, this.businessDeps());
    registerPlayReleasesReadTools(server, ws, run, this.playReleases);

    if (!auth.scopes.includes(SCOPES.WRITE)) return server;

    server.registerTool(
      "draft_review_reply",
      {
        title: "Draft a reply with the owner's template and voice",
        description:
          "Let TreeVook draft a reply for one review using the template set for its star rating, the owner's voice and language settings. The draft lands in the owner's inbox; nothing is posted. Set rewrite to get a different wording than the current draft.",
        inputSchema: {
          review_id: z.string().uuid(),
          rewrite: z.boolean().default(false),
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
          const view = await this.playInbox.draft(
            actor,
            a.review_id,
            a.rewrite,
          );
          return {
            review_id: view.id,
            state: view.state,
            draft: view.draft?.text ?? null,
            note: view.draft?.note ?? null,
            url: this.play.reviewsUrl(view.appId),
          };
        }),
    );

    const confirmed = async (
      tool: string,
      args: Record<string, unknown>,
      token: string | undefined,
      preview: () => Promise<{ changes: string[]; enablesAuto: boolean }>,
      apply: () => Promise<unknown>,
    ) => {
      const p = await preview();
      if (!p.changes.length)
        return { status: "no_changes", message: "Nothing to change." };
      if (p.enablesAuto && !(await this.playAgent.agentsCanPost(ws)))
        return {
          status: "auto_needs_permission",
          message:
            'Auto mode posts replies without approval, and the owner hasn\'t allowed agents to post. Ask them to turn on "Allow agents to post replies" on the Play Reviews MCP page, or keep these ratings on approval.',
          changes: p.changes,
        };
      if (!token)
        return {
          status: "confirmation_required",
          summary: p.changes,
          confirmToken: await this.confirmations.issue(ws, tool, args),
        };
      if (!(await this.confirmations.consume(ws, tool, args, token)))
        return {
          status: "invalid_confirmation",
          message:
            "This confirmation is invalid, expired, used, or for different changes. Call again without confirm_token.",
        };
      return { status: "applied", result: await apply() };
    };

    const ratingMode = z.enum(["auto", "approval", "manual"]);
    const settingsShape = {
      enabled: z.boolean().optional(),
      title: z.string().min(1).max(80).optional(),
      rating_rules: z
        .array(
          z.object({
            rating: z.number().int().min(1).max(5),
            mode: ratingMode.optional(),
            template_id: z.string().uuid().nullable().optional(),
          }),
        )
        .max(5)
        .optional(),
      delay: z.enum(["instant", "15m", "1h", "6h"]).optional(),
      tone: z.enum(["friendly", "professional", "concise"]).optional(),
      translate: z.boolean().optional(),
      personalize: z.boolean().optional(),
      skip_empty: z.boolean().optional(),
      escalate: z.boolean().optional(),
      auto_pause: z.boolean().optional(),
      reply_to_edited: z.boolean().optional(),
      timezone: z.string().max(64).optional(),
      quiet_hours: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .nullable()
        .optional(),
      daily_auto_limit: z.number().int().min(0).max(500).optional(),
      never_auto_words: z.array(z.string().max(40)).max(100).optional(),
      placeholders: z.record(z.string(), z.string().max(200)).optional(),
    };
    type SettingsArgs = {
      [K in keyof typeof settingsShape]?: z.infer<(typeof settingsShape)[K]>;
    };
    const toUpdate = (a: SettingsArgs) => {
      const settings = Object.fromEntries(
        Object.entries({
          ratingRules: a.rating_rules?.map((r) => ({
            rating: r.rating,
            mode: r.mode,
            templateId: r.template_id,
          })),
          delay: a.delay,
          tone: a.tone,
          translate: a.translate,
          personalize: a.personalize,
          skipEmpty: a.skip_empty,
          escalate: a.escalate,
          autoPause: a.auto_pause,
          replyToEdited: a.reply_to_edited,
          timezone: a.timezone,
          quietHours: a.quiet_hours,
          dailyAutoLimit: a.daily_auto_limit,
          neverAutoWords: a.never_auto_words,
        }).filter(([, v]) => v !== undefined),
      );
      return {
        ...(a.title !== undefined ? { title: a.title } : {}),
        ...(a.enabled !== undefined ? { automation: a.enabled } : {}),
        ...(Object.keys(settings).length ? { settings } : {}),
        ...(a.placeholders ? { variables: a.placeholders } : {}),
      } as Parameters<PlayAgentService["applyApp"]>[2];
    };

    server.registerTool(
      "update_review_settings",
      {
        title: "Change an app's review reply settings (needs confirmation)",
        description:
          "Change any of an app's settings: auto-reply on/off (enabled), name, per-rating mode (auto/approval/manual) and template (template_id, null for AI-written), posting delay, voice, translate, personalize, skip star-only, escalate 1-star, safety pause, reply to edited, time zone, quiet hours (null to turn off), daily automatic limit, never-auto words (replaces the list) and placeholder values (merged; empty string clears one). Only send what changes. Two steps: call without confirm_token to get a summary, show it to the user, then call again with the same arguments and confirm_token after they agree. Turning a rating to auto needs the owner to allow agents to post.",
        inputSchema: {
          app_id: appId,
          ...settingsShape,
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      ({ confirm_token, ...a }) =>
        run(() =>
          confirmed(
            "update_review_settings",
            a,
            confirm_token,
            () => this.playAgent.previewApp(ws, a.app_id, toUpdate(a)),
            () => this.playAgent.applyApp(actor, a.app_id, toUpdate(a)),
          ),
        ),
    );

    const ruleShape = z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(60),
      enabled: z.boolean().default(true),
      conditions: z.object({
        stars: z.array(z.number().int().min(1).max(5)).optional(),
        keywords_any: z.array(z.string().max(40)).max(50).optional(),
        keywords_none: z.array(z.string().max(40)).max(50).optional(),
        languages: z.array(z.string().max(10)).optional(),
        app_versions: z.array(z.string().max(40)).max(20).optional(),
        edited: z.boolean().optional(),
      }),
      action: z.enum(["template", "claude", "skip"]),
      template_id: z.string().uuid().optional(),
      mode: z.enum(["approval", "auto"]).default("approval"),
      delay_minutes: z.number().int().min(0).max(1440).default(30),
    });
    const toRules = (rules: z.infer<typeof ruleShape>[]) =>
      rules.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name,
        enabled: r.enabled,
        conditions: {
          stars: r.conditions.stars,
          keywordsAny: r.conditions.keywords_any,
          keywordsNone: r.conditions.keywords_none,
          languages: r.conditions.languages,
          appVersions: r.conditions.app_versions,
          edited: r.conditions.edited,
        },
        action:
          r.action === "template"
            ? { type: "template" as const, templateId: r.template_id ?? "" }
            : { type: r.action },
        mode: r.mode,
        delayMinutes: r.delay_minutes,
      }));

    server.registerTool(
      "set_review_rules",
      {
        title: "Replace an app's advanced keyword rules (needs confirmation)",
        description:
          "Replace the ordered list of advanced rules that run before the per-rating rules (first match wins). Send the full list you want, including existing rules by id. action: template (with template_id), claude (wait for you through the connector) or skip. Two steps with confirm_token, like update_review_settings.",
        inputSchema: {
          app_id: appId,
          rules: z.array(ruleShape).max(30),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      ({ confirm_token, ...a }) =>
        run(() =>
          confirmed(
            "set_review_rules",
            a,
            confirm_token,
            () => this.playAgent.previewRules(ws, a.app_id, toRules(a.rules)),
            () => this.playAgent.applyRules(actor, a.app_id, toRules(a.rules)),
          ),
        ),
    );

    server.registerTool(
      "update_review_workspace",
      {
        title:
          "Change workspace AI drafting or Slack channel (needs confirmation)",
        description:
          "Change workspace-wide settings: ai_mode (platform = TreeVook's AI, own = the owner's saved Anthropic key, off = templates only) and the Slack channel name used for 1-star escalations. API keys, the Slack webhook and agent posting permission can only be changed by the owner in TreeVook. Two steps with confirm_token.",
        inputSchema: {
          ai_mode: z.enum(["platform", "own", "off"]).optional(),
          slack_channel: z.string().max(81).nullable().optional(),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      ({ confirm_token, ...a }) => {
        const input = {
          ...(a.ai_mode ? { aiMode: a.ai_mode } : {}),
          ...(a.slack_channel !== undefined
            ? { slackChannel: a.slack_channel }
            : {}),
        };
        return run(() =>
          confirmed(
            "update_review_workspace",
            a,
            confirm_token,
            () => this.playAgent.previewWorkspace(ws, input),
            () => this.playAgent.applyWorkspace(actor, input),
          ),
        );
      },
    );

    server.registerTool(
      "delete_review_template",
      {
        title: "Delete one of the owner's templates (needs confirmation)",
        description:
          "Delete a template the owner created. Pre-built templates and templates used by a rating can't be deleted. Two steps with confirm_token.",
        inputSchema: {
          template_id: z.string().uuid(),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      ({ confirm_token, ...a }) =>
        run(async () => {
          const list = (await this.play.templates(ws)).data;
          const t = list.find((x) => x.id === a.template_id);
          return confirmed(
            "delete_review_template",
            a,
            confirm_token,
            async () => ({
              changes: t ? [`Delete template "${t.name}"`] : [],
              enablesAuto: false,
            }),
            async () => {
              await this.play.deleteTemplate(actor, a.template_id);
              return { deleted: a.template_id };
            },
          );
        }),
    );

    server.registerTool(
      "set_template_hidden",
      {
        title: "Hide or show a pre-built template",
        description:
          "Hide a pre-built template the owner doesn't use (hidden: true) so it stops appearing in template pickers, or show it again (hidden: false). Nothing is deleted. A template used by a star rating or an advanced rule can't be hidden; change that first with update_review_settings or set_review_rules. The owner's own templates are deleted with delete_review_template instead.",
        inputSchema: {
          template_id: z.string().uuid(),
          hidden: z.boolean(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (a) =>
        run(async () => {
          const t = await this.play.setTemplateHidden(
            actor,
            a.template_id,
            a.hidden,
          );
          return { id: t.id, name: t.name, hidden: t.hidden };
        }),
    );

    server.registerTool(
      "sync_play_apps",
      {
        title: "Fetch new reviews and find newly shared apps",
        description:
          "Look for apps newly shared with the service account, then fetch the latest reviews for every app (or only app_id). Apps that lost access are hidden from the list and come back when access returns.",
        inputSchema: { app_id: appId.optional() },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (a) =>
        run(async () => {
          const added: string[] = [];
          if (!a.app_id)
            for (const c of (await this.play.connections(ws)).data) {
              const found = await this.play
                .discover(actor, c.id)
                .catch(() => null);
              if (found) added.push(...found.added.map((x) => x.title));
            }
          const apps = a.app_id
            ? [await this.play.appRow(ws, a.app_id)]
            : (await this.play.apps(ws)).data;
          const results = [];
          for (const app of apps) {
            const r = await this.play
              .syncNow(actor, app.id)
              .then((x) => ({ app: app.title, ...x }))
              .catch((err: Error) => ({ app: app.title, error: err.message }));
            results.push(r);
          }
          return { added, results };
        }),
    );

    server.registerTool(
      "import_review_history",
      {
        title: "Import older reviews from the Play Console reports",
        description:
          "Import an app's monthly review reports from the Play Console reports bucket the owner connected (only new or changed months). Needs the reports URI to be set in TreeVook.",
        inputSchema: { app_id: appId },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (a) => run(() => this.play.importHistory(actor, a.app_id)),
    );

    server.registerTool(
      "upsert_review_template",
      {
        title: "Create or edit a reply template",
        description:
          "Create a reply template, or edit one of the owner's own templates by template_id (pre-built templates are read-only: create a new one instead). Placeholders use single braces: {user_name}, {app_name}, {rating}, {version}, {support_email}, {developer_name}, or any value the app defines. Give either body (one English wording) or bodies (one entry per language, each with 1-10 wordings that rotate per review). ratings lists the star ratings it's meant for; app_id makes it available to one app only. The reply must fit 350 characters once filled. The result includes problems (missing values, too long) and filled-in samples; fix problems before using it. To make a rating use it, call update_review_settings with its id.",
        inputSchema: {
          template_id: z.string().uuid().optional(),
          name: z.string().min(1).max(60),
          ratings: z.array(z.number().int().min(1).max(5)).max(5).default([]),
          body: z.string().min(1).max(1000).optional(),
          bodies: z
            .array(
              z.object({
                language: z.string().min(2).max(10),
                variants: z.array(z.string().min(1).max(1000)).min(1).max(10),
              }),
            )
            .min(1)
            .max(20)
            .optional(),
          app_id: appId.optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (a) =>
        run(async () => {
          const bodies =
            a.bodies ??
            (a.body ? [{ language: "en", variants: [a.body] }] : null);
          if (!bodies)
            throw new ValidationError(
              "Give the template text as body or bodies.",
            );
          const input = {
            name: a.name,
            ratings: a.ratings,
            bodies,
            appId: a.app_id ?? null,
          };
          const template = a.template_id
            ? await this.play.updateTemplate(actor, a.template_id, input)
            : await this.play.createTemplate(actor, input);
          const check = await this.play.checkDraft(ws, {
            bodies,
            appId: a.app_id ?? null,
          });
          return {
            id: template.id,
            name: template.name,
            ratings: template.ratings,
            app_id: template.appId,
            problems: check.problems,
            samples: check.samples.map((x) => ({
              language: x.language,
              text: x.text,
              length: x.length,
            })),
            url: this.play.templatesUrl(),
          };
        }),
    );

    server.registerTool(
      "save_review_drafts",
      {
        title: "Save review reply drafts",
        description:
          "Save up to 25 reply drafts for the owner to approve in TreeVook. Nothing is posted. Returns each review's new state and the review page url to share.",
        inputSchema: {
          app_id: appId,
          drafts: z
            .array(
              z.object({
                review_id: z.string().uuid(),
                text: z.string().min(1).max(350),
              }),
            )
            .min(1)
            .max(25),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (a) =>
        run(async () => {
          const saved = [];
          for (const d of a.drafts) {
            const view = await this.play.saveDraft(
              actor,
              a.app_id,
              d.review_id,
              { text: d.text, source: "claude" },
            );
            saved.push({ review_id: view.id, state: view.state });
          }
          return { saved, url: this.play.reviewsUrl(a.app_id) };
        }),
    );

    server.registerTool(
      "send_review_reply",
      {
        title: "Reply on Google Play (needs confirmation)",
        description:
          "Post a public reply to a Google Play review, or replace the existing one. Two steps: call without confirm_token to check it and get a summary, show the reply to the user, then call again with the same arguments and confirm_token after they explicitly agree.",
        inputSchema: {
          app_id: appId,
          review_id: z.string().uuid(),
          text: z.string().min(1).max(350),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      (a) =>
        run(async () => {
          if (!(await this.playWorkspace.agentsCanPost(ws)))
            return {
              status: "posting_disabled",
              message:
                'The owner hasn\'t allowed agents to post replies. Save the reply with save_review_drafts so they can approve it in their inbox, or ask them to turn on "Allow agents to post replies" on the Play Reviews MCP page.',
              url: this.play.reviewsUrl(a.app_id),
            };
          const args = {
            app_id: a.app_id,
            review_id: a.review_id,
            text: a.text,
          };
          if (!a.confirm_token) {
            const review = await this.play.reviewForClaude(
              ws,
              a.app_id,
              a.review_id,
            );
            return {
              status: "confirmation_required",
              summary: `Reply publicly to ${review.author}'s ${review.stars}-star review${review.current_reply ? ", replacing the current reply" : ""}: "${a.text}"`,
              confirmToken: await this.confirmations.issue(
                ws,
                "send_review_reply",
                args,
              ),
            };
          }
          const ok = await this.confirmations.consume(
            ws,
            "send_review_reply",
            args,
            a.confirm_token,
          );
          if (!ok)
            return {
              status: "invalid_confirmation",
              message:
                "This confirmation is invalid, expired, used, or for a different reply. Call again without confirm_token.",
            };
          const view = await this.play.replyNow(actor, a.app_id, a.review_id, {
            text: a.text,
            source: "claude",
          });
          return { status: "sent", review_id: view.id, reply: view.reply };
        }),
    );

    server.registerTool(
      "store_save_project",
      {
        title: "Save a store listing project",
        description:
          "Create or update the Google Play store listing project for an app (matched by slug, which defaults to the name) and get an upload token. Pass upload_url and upload_token to the store-creatives plugin's upload_to_platform tool; the files go straight from the user's machine to TreeVook. Share url with the user to choose a style. The token lasts two hours.",
        inputSchema: {
          name: z.string().min(1).max(80),
          slug: z.string().regex(SLUG).optional(),
          languages: z.array(z.string().regex(LANG)).min(1).max(20),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (a) =>
        run(() =>
          this.store.save(actor, {
            name: a.name,
            slug: a.slug,
            languages: a.languages,
          }),
        ),
    );

    server.registerTool(
      "store_start_upload",
      {
        title: "New store upload token",
        description:
          "A fresh two-hour upload token for an existing store listing project, for the plugin's upload_to_platform tool.",
        inputSchema: { project_id: z.string().uuid() },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      (a) => run(() => this.store.startUpload(actor, a.project_id)),
    );

    server.registerTool(
      "save_profile_draft",
      {
        title: "Save profile draft",
        description:
          "Save proposed profile changes for the owner to review in TreeVook. facebook: about (short description, max 255), description (longer), website, phone, email, pictureCreativeId, coverCreativeId. instagram: name (max 30), bio (max 150), website, pictureCreativeId. Creative ids come from save_ad_creative or list_creatives. Send the full draft each time.",
        inputSchema: {
          facebook: z
            .object({
              about: z.string().max(255).optional(),
              description: z.string().max(2000).optional(),
              website: z.string().url().optional(),
              phone: z.string().max(30).optional(),
              email: z.string().email().optional(),
              pictureCreativeId: z.string().uuid().optional(),
              coverCreativeId: z.string().uuid().optional(),
            })
            .optional(),
          instagram: z
            .object({
              name: z.string().max(30).optional(),
              bio: z.string().max(150).optional(),
              website: z.string().url().optional(),
              pictureCreativeId: z.string().uuid().optional(),
            })
            .optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (a) =>
        run(() =>
          this.profile.saveDraft(actor, {
            facebook: a.facebook ?? {},
            instagram: a.instagram ?? {},
          }),
        ),
    );

    server.registerTool(
      "apply_facebook_profile",
      {
        title: "Apply profile to the Facebook Page (needs confirmation)",
        description:
          "Apply parts of the saved draft to the Facebook Page: about, description, website, phone, email, picture, cover. Two steps: call without confirm_token to get a summary, show it to the user, then call again with confirm_token after they agree.",
        inputSchema: {
          parts: z.array(z.enum(FACEBOOK_PARTS)).min(1),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (a) =>
        run(async () => {
          const args = { parts: [...new Set(a.parts)].sort() };
          if (!a.confirm_token) {
            return {
              status: "confirmation_required",
              summary: `Update the Facebook Page: ${args.parts.join(", ")}. Visitors will see the changes right away.`,
              confirmToken: await this.confirmations.issue(
                ws,
                "apply_facebook_profile",
                args,
              ),
              expiresInSeconds: CONFIRM_TTL_SECONDS,
            };
          }
          if (
            !(await this.confirmations.consume(
              ws,
              "apply_facebook_profile",
              args,
              a.confirm_token,
            ))
          ) {
            return {
              status: "invalid_confirmation",
              message: "Call again without confirm_token for a fresh summary.",
            };
          }
          return this.profile.applyFacebook(actor, args.parts);
        }),
    );

    server.registerTool(
      "publish_post",
      {
        title: "Publish to Facebook and Instagram (needs confirmation)",
        description:
          "Post a creative from the library to the Facebook Page and/or Instagram, now or at scheduled_at (ISO 8601, 2 minutes to 60 days ahead). Two steps: call without confirm_token to validate and get a summary, show it to the user, then call again with the same arguments and confirm_token after the user explicitly agrees.",
        inputSchema: {
          creative_id: z.string().uuid(),
          platforms: z
            .array(z.enum(["facebook", "instagram"]))
            .min(1)
            .max(2),
          facebook_caption: z.string().max(5000).optional(),
          instagram_caption: z.string().max(2200).optional(),
          scheduled_at: z.string().datetime({ offset: true }).optional(),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      (a) =>
        run(async () => {
          const input = {
            creativeId: a.creative_id,
            platforms: a.platforms,
            facebookCaption: a.facebook_caption ?? null,
            instagramCaption: a.instagram_caption ?? null,
            scheduledAt: a.scheduled_at ?? null,
          };
          const args = {
            ...input,
            platforms: [...new Set(a.platforms)].sort(),
          };
          if (!a.confirm_token) {
            const { creative, channels, scheduledAt } =
              await this.social.validate(actor, input);
            const where = args.platforms
              .map((p) =>
                p === "facebook"
                  ? `Facebook Page "${channels.facebook?.name}"`
                  : `Instagram ${channels.instagram?.username}`,
              )
              .join(" and ");
            return {
              status: "confirmation_required",
              summary: `Post "${creative.name}" to ${where} ${scheduledAt ? `on ${scheduledAt.toISOString()}` : "right now"}. It will be public.`,
              confirmToken: await this.confirmations.issue(
                ws,
                "publish_post",
                args,
              ),
              expiresInSeconds: CONFIRM_TTL_SECONDS,
            };
          }
          const ok = await this.confirmations.consume(
            ws,
            "publish_post",
            args,
            a.confirm_token,
          );
          if (!ok) {
            return {
              status: "invalid_confirmation",
              message:
                "This confirmation is invalid, expired, used, or for different settings. Call again without confirm_token.",
            };
          }
          return this.social.create(actor, input);
        }),
    );

    server.registerTool(
      "save_ad_creative",
      {
        title: "Save an ad image",
        description: `Render an SVG design to a PNG and save it in the TreeVook creatives library. Formats: ${Object.entries(
          SVG_FORMATS,
        )
          .map(([k, v]) => `${k} ${v.width}x${v.height}`)
          .join(
            ", ",
          )}. The SVG viewBox must match the format's aspect ratio. Use common fonts (Helvetica, Arial, sans-serif). Returns the creative id and public image url.`,
        inputSchema: {
          name: z.string().min(1).max(120),
          svg: z.string().min(20),
          format: z
            .enum(
              Object.keys(SVG_FORMATS) as [
                keyof typeof SVG_FORMATS,
                ...(keyof typeof SVG_FORMATS)[],
              ],
            )
            .default("square"),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      (a) =>
        run(() =>
          this.creatives.fromSvg(actor, {
            name: a.name,
            svg: a.svg,
            format: a.format,
          }),
        ),
    );

    server.registerTool(
      "propose_campaign_plan",
      {
        title: "Propose a campaign plan",
        description:
          "Save a complete campaign plan for the owner to review in TreeVook. Fill every setting and explain each choice in reasons (goal, audience, budget, creative) using evidence from get_planning_context and the business. Use location and interest keys from search_targeting. dailyBudget is in the account currency. Use a creative url from list_creatives or save_ad_creative as imageUrl, or set creative.post to run the ad on an existing Facebook or Instagram post from list_social_posts (best when the post already has engagement). Otherwise leave imageUrl empty and describe the ideal image in imageIdea. Returns a review link to share with the user. Nothing is created in Meta by this tool.",
        inputSchema: planSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      (plan) =>
        run(async () => {
          const view = await this.plans.propose(actor, plan);
          return {
            planId: view.id,
            status: view.status,
            reviewUrl: this.plans.reviewUrl(view.id),
          };
        }),
    );

    server.registerTool(
      "update_campaign_plan",
      {
        title: "Revise a campaign plan",
        description:
          "Replace a draft plan with a revised version, for example after the user asks for changes. Send the complete plan.",
        inputSchema: { plan_id: z.string().uuid(), plan: planSchema },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      (a) =>
        run(async () => {
          const view = await this.plans.replace(actor, a.plan_id, a.plan);
          return {
            planId: view.id,
            status: view.status,
            reviewUrl: this.plans.reviewUrl(view.id),
          };
        }),
    );

    server.registerTool(
      "create_campaign_draft",
      {
        title: "Create a paused campaign",
        description:
          "Creates a campaign, ad set, creative and ad in Meta, all PAUSED, using the selected Page, Instagram account and Pixel. Goals: traffic (landing page views), leads (website leads via the Pixel), sales (website purchases via the Pixel), awareness (reach). daily_budget is in the account currency (major units). Agree the copy, image, audience and budget with the user before calling.",
        inputSchema: {
          name: z.string().min(3).max(200),
          goal: z.enum(GOAL_NAMES as [string, ...string[]]),
          conversion_event: z.enum(CONVERSION_EVENTS).optional(),
          daily_budget: z.number().positive(),
          targeting: z.object({
            countries: z.array(z.string().length(2)).max(25).optional(),
            region_keys: z.array(z.string()).max(50).optional(),
            cities: z
              .array(
                z.object({
                  key: z.string(),
                  radius_km: z.number().min(10).max(80).optional(),
                }),
              )
              .max(250)
              .optional(),
            age_min: z.number().int().min(18).max(65).optional(),
            age_max: z.number().int().min(18).max(65).optional(),
            genders: z.enum(["all", "male", "female"]).optional(),
            interests: z
              .array(z.object({ id: z.string(), name: z.string().optional() }))
              .max(25)
              .optional(),
          }),
          creative: z.object({
            primary_text: z.string().min(1).max(2000),
            headline: z.string().min(1).max(255),
            description: z.string().max(255).optional(),
            link_url: z.string().url().startsWith("https://"),
            image_url: z.string().url().startsWith("https://").optional(),
            image_hash: z.string().optional(),
            call_to_action: z.enum(CALLS_TO_ACTION).default("LEARN_MORE"),
          }),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (a) =>
        run(() =>
          this.ads.createDraft(actor, {
            name: a.name,
            goal: a.goal as (typeof GOAL_NAMES)[number],
            conversionEvent: a.conversion_event,
            dailyBudget: a.daily_budget,
            targeting: {
              countries: a.targeting.countries?.map((c) => c.toUpperCase()),
              regionKeys: a.targeting.region_keys,
              cities: a.targeting.cities?.map((c) => ({
                key: c.key,
                radiusKm: c.radius_km,
              })),
              ageMin: a.targeting.age_min,
              ageMax: a.targeting.age_max,
              genders: a.targeting.genders,
              interests: a.targeting.interests,
            },
            creative: {
              primaryText: a.creative.primary_text,
              headline: a.creative.headline,
              description: a.creative.description,
              linkUrl: a.creative.link_url,
              imageUrl: a.creative.image_url,
              imageHash: a.creative.image_hash,
              callToAction: a.creative.call_to_action,
            },
          }),
        ),
    );

    server.registerTool(
      "pause",
      {
        title: "Pause",
        description:
          "Pause a campaign, ad set or ad immediately. Spending stops right away.",
        inputSchema: { id },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (a) => run(() => this.ads.pause(actor, a.id)),
    );

    server.registerTool(
      "activate",
      {
        title: "Turn on (needs confirmation)",
        description:
          "Turn on a campaign, ad set or ad so it starts spending. include_children also turns on paused ad sets and ads inside it. Two steps: call without confirm_token to get a summary and token, show the summary to the user, and call again with confirm_token only after the user explicitly agrees.",
        inputSchema: {
          id,
          include_children: z.boolean().default(true),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      (a) =>
        run(() =>
          this.ads.activate(actor, a.id, a.include_children, a.confirm_token),
        ),
    );

    server.registerTool(
      "update_daily_budget",
      {
        title: "Change daily budget (needs confirmation)",
        description:
          "Change the daily budget of a campaign or ad set, in the account currency (major units). Two steps, like activate: get the summary and token, show it to the user, call again with confirm_token after the user agrees.",
        inputSchema: {
          id,
          daily_budget: z.number().positive(),
          confirm_token: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      (a) =>
        run(() =>
          this.ads.updateDailyBudget(
            actor,
            a.id,
            a.daily_budget,
            a.confirm_token,
          ),
        ),
    );

    registerBusinessWriteTools(
      server,
      ws,
      actor,
      run,
      confirmed,
      this.businessDeps(),
    );
    registerPlayReleasesWriteTools(
      server,
      actor,
      run,
      confirmed,
      this.playReleases,
    );

    return server;
  }

  private businessDeps() {
    return {
      business: this.business,
      reviews: this.businessReviews,
      workspaceAi: this.workspaceAi,
      config: this.config,
    };
  }

  private async run(fn: () => Promise<unknown>): Promise<CallToolResult> {
    try {
      const data = await fn();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      if (err instanceof DomainError) {
        const details = err.details ? `\n${JSON.stringify(err.details)}` : "";
        return {
          isError: true,
          content: [
            { type: "text", text: `${err.code}: ${err.message}${details}` },
          ],
        };
      }
      this.logger.error(
        "MCP tool failed",
        err instanceof Error ? err.stack : String(err),
      );
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Something went wrong on our side. Please try again.",
          },
        ],
      };
    }
  }
}
