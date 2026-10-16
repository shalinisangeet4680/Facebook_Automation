import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { BusinessActor } from "@modules/business/application/business-engine.service";
import { BusinessReviewsService } from "@modules/business/application/business-reviews.service";
import {
  BusinessService,
  LocationUpdate,
} from "@modules/business/application/business.service";
import { CTA_TYPES, WEEKDAYS } from "@modules/business/domain/business.types";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { appUrl, AppConfig } from "@shared/config/app-config";

type Confirmed = (
  tool: string,
  args: Record<string, unknown>,
  token: string | undefined,
  preview: () => Promise<{ changes: string[]; enablesAuto: boolean }>,
  apply: () => Promise<unknown>,
) => Promise<unknown>;

export interface BusinessToolDeps {
  business: BusinessService;
  reviews: BusinessReviewsService;
  workspaceAi: WorkspaceAiService;
  config: AppConfig;
}

export const BUSINESS_INSTRUCTIONS =
  "- Google Business Profile: list_business_locations first. list_business_reviews shows reviews needing a reply (or replied/all). Write replies as the business owner: warm, specific to what the customer said, in their language, no promises of refunds or outcomes, and never reveal private details about a customer or patient. Save drafts with save_business_review_drafts so the owner approves them in TreeVook; send_business_review_reply posts publicly and is two-step. create_business_post publishes or schedules an update, offer or event (two-step unless saved as a draft); keep posts short, useful and without phone numbers in the text (use the Call button). get_business_insights explains views, calls, website clicks and direction requests; Google publishes these with a 2–3 day delay. update_business_info changes the name, description (max 750 characters, no links), phone, website or opening hours, and update_business_reply_settings changes per-rating reply modes, voice and safeguards; both are two-step.";

export function registerBusinessReadTools(
  server: McpServer,
  ws: string,
  run: (fn: () => Promise<unknown>) => Promise<CallToolResult>,
  deps: BusinessToolDeps,
) {
  const { business, reviews } = deps;
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const locationId = z
    .string()
    .uuid()
    .describe("A location id from list_business_locations");
  const url = (path = "") => `${appUrl(deps.config)}/business${path}`;

  server.registerTool(
    "list_business_locations",
    {
      title: "Google Business locations",
      description:
        "Every Google Business Profile location connected to TreeVook with its rating, review count, reviews needing a reply, reply mode and sync health.",
      annotations: readOnly,
    },
    () => run(async () => ({ ...(await business.locations(ws)), url: url() })),
  );

  server.registerTool(
    "list_business_reviews",
    {
      title: "Google Business reviews",
      description:
        "Google reviews for one location or all of them. filter pending (default) holds reviews without a reply, with any draft; replied holds answered ones. Each item has the review id to use with the reply tools.",
      inputSchema: {
        location_id: locationId.optional(),
        filter: z.enum(["pending", "replied", "all"]).default("pending"),
        stars: z.array(z.number().int().min(1).max(5)).max(5).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const inbox = await reviews.inbox(
          ws,
          a.filter,
          a.location_id,
          a.stars,
          a.limit,
        );
        return {
          counts: inbox.counts,
          reviews: inbox.data.map((r) => ({
            review_id: r.id,
            location_id: r.locationId,
            author: r.authorName,
            stars: r.stars,
            text: r.text,
            reviewed_at: r.reviewedAt,
            topic: r.topic,
            state: r.state,
            current_reply: r.reply?.text ?? null,
            draft: r.draft
              ? { text: r.draft.text, status: r.draft.status }
              : null,
          })),
        };
      }),
  );

  server.registerTool(
    "get_business_profile",
    {
      title: "Google Business profile and reply settings",
      description:
        "A location's business information (name, description, phone, website, address, categories, opening hours), its reply settings per star rating, placeholder values and the reply templates it can use.",
      inputSchema: { location_id: locationId },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const [detail, templates] = await Promise.all([
          business.location(ws, a.location_id),
          business.templates(ws, a.location_id),
        ]);
        return {
          ...detail,
          templates: templates.data
            .filter((t) => !t.hidden)
            .map((t) => ({
              id: t.id,
              name: t.name,
              ratings: t.ratings,
              bodies: t.bodies,
            })),
          url: url(`/${a.location_id}`),
        };
      }),
  );

  server.registerTool(
    "get_business_insights",
    {
      title: "Google Business insights",
      description:
        "Profile performance (search and Maps views, calls, website clicks, direction requests, messages, bookings) and review analytics (rating, reply rate, response time, topics) for one location or all, over the last 7, 30 or 90 days, compared with the period before.",
      inputSchema: {
        location_id: locationId.optional(),
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      },
      annotations: readOnly,
    },
    (a) =>
      run(async () => {
        const [profile, reviewStats] = await Promise.all([
          business.insights(ws, a.location_id, { days: a.days }),
          reviews.analytics(ws, a.location_id, { days: a.days }),
        ]);
        return {
          profile: {
            current: profile.current,
            previous: profile.previous,
            last_day_with_data: profile.lastDay,
            note: profile.note,
          },
          reviews: {
            current: reviewStats.current,
            previous: reviewStats.previous,
            distribution: reviewStats.distribution,
            topics: reviewStats.topics,
            replies_sent: reviewStats.repliesSent,
          },
        };
      }),
  );
}

export function registerBusinessWriteTools(
  server: McpServer,
  ws: string,
  actor: BusinessActor,
  run: (fn: () => Promise<unknown>) => Promise<CallToolResult>,
  confirmed: Confirmed,
  deps: BusinessToolDeps,
) {
  const { business, reviews } = deps;
  const locationId = z
    .string()
    .uuid()
    .describe("A location id from list_business_locations");
  const url = (path = "") => `${appUrl(deps.config)}/business${path}`;
  server.registerTool(
    "save_business_review_drafts",
    {
      title: "Save Google review reply drafts",
      description:
        "Save up to 25 reply drafts for the owner to approve in TreeVook. Nothing is posted. Returns each review's new state and the inbox url to share.",
      inputSchema: {
        drafts: z
          .array(
            z.object({
              review_id: z.string().uuid(),
              text: z.string().min(1).max(4096),
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
          const view = await reviews.saveDraft(actor, d.review_id, {
            text: d.text,
            source: "claude",
          });
          saved.push({ review_id: view.id, state: view.state });
        }
        return { saved, url: url() };
      }),
  );

  server.registerTool(
    "send_business_review_reply",
    {
      title: "Reply on Google (needs confirmation)",
      description:
        "Post a public owner reply to a Google review, or replace the current one. Two steps: call without confirm_token to get a summary, show the reply to the user, then call again with the same arguments and confirm_token after they explicitly agree.",
      inputSchema: {
        review_id: z.string().uuid(),
        text: z.string().min(1).max(4096),
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
        const settings = await deps.workspaceAi.settings(ws);
        if (!settings?.agentsCanPost)
          return {
            status: "posting_disabled",
            message:
              'The owner hasn\'t allowed agents to post replies. Save the reply with save_business_review_drafts so they can approve it, or ask them to turn on "Allow agents to post replies" in TreeVook.',
            url: url(),
          };
        const review = await reviews.view(a.review_id);
        return confirmed(
          "send_business_review_reply",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                `Reply publicly to ${review.authorName || "a customer"}'s ${review.stars}-star review${review.reply ? ", replacing the current reply" : ""}: "${a.text}"`,
              ],
              enablesAuto: false,
            }),
          () =>
            reviews.replyNow(actor, a.review_id, {
              text: a.text,
              source: "claude",
            }),
        );
      }),
  );

  const isoTime = z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Use an ISO date-time");

  server.registerTool(
    "create_business_post",
    {
      title: "Post on Google Business (needs confirmation)",
      description:
        "Create a Google Business Profile post. type STANDARD is an update, OFFER needs event title/start/end and can have a coupon, EVENT needs title/start/end. button is one of BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP (with an https link) or CALL (no link). image_url must be a public https image (save_ad_creative returns one). when: now, schedule (with scheduled_at) or draft. Drafts are saved straight away; now and schedule are two-step: show the summary, wait for an explicit yes, call again with confirm_token.",
      inputSchema: {
        location_id: locationId,
        type: z.enum(["STANDARD", "OFFER", "EVENT"]).default("STANDARD"),
        text: z.string().min(1).max(1500),
        image_url: z.string().url().optional(),
        button: z.enum(CTA_TYPES).optional(),
        button_url: z.string().url().optional(),
        event_title: z.string().max(58).optional(),
        start: isoTime.optional(),
        end: isoTime.optional(),
        coupon_code: z.string().max(58).optional(),
        redeem_url: z.string().url().optional(),
        terms: z.string().max(5000).optional(),
        when: z.enum(["now", "schedule", "draft"]).default("now"),
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
          locationId: a.location_id,
          when: a.when,
          scheduledAt: a.scheduled_at ?? null,
          content: {
            type: a.type,
            summary: a.text,
            mediaUrl: a.image_url ?? null,
            cta: a.button
              ? { type: a.button, url: a.button_url ?? null }
              : null,
            event:
              a.type === "STANDARD"
                ? null
                : {
                    title: a.event_title ?? "",
                    start: a.start ?? "",
                    end: a.end ?? "",
                  },
            offer:
              a.type === "OFFER"
                ? {
                    couponCode: a.coupon_code ?? null,
                    redeemUrl: a.redeem_url ?? null,
                    terms: a.terms ?? null,
                  }
                : null,
          },
        };
        if (a.when === "draft") {
          const post = await business.createPost(actor, input);
          return {
            status: "saved",
            post,
            url: url(`/${a.location_id}?tab=posts`),
          };
        }
        const location = await business.location(ws, a.location_id);
        return confirmed(
          "create_business_post",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                `${a.when === "now" ? "Publish now" : `Schedule for ${a.scheduled_at}`} on ${location.title}: ${a.type.toLowerCase()} post "${a.text}"${a.button ? ` with a ${a.button} button` : ""}${a.image_url ? " and an image" : ""}`,
              ],
              enablesAuto: false,
            }),
          () => business.createPost(actor, input),
        );
      }),
  );

  const period = z.object({
    day: z.enum(WEEKDAYS),
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  });

  server.registerTool(
    "update_business_info",
    {
      title: "Edit Google Business information (needs confirmation)",
      description:
        "Change a location's name, description (max 750 characters, no links), primary phone, website or regular opening hours (the full week; days you leave out are closed; use 24:00 for midnight). Google may review some edits before they go live. Two steps with confirm_token.",
      inputSchema: {
        location_id: locationId,
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(750).optional(),
        phone: z.string().max(40).optional(),
        website: z.string().url().optional(),
        hours: z.array(period).max(28).optional(),
        confirm_token: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ confirm_token, location_id, ...patch }) =>
      run(async () => {
        const preview = await business.previewInfo(ws, location_id, patch);
        if (preview.problems.length)
          return { status: "invalid", problems: preview.problems };
        return confirmed(
          "update_business_info",
          { location_id, ...patch },
          confirm_token,
          () =>
            Promise.resolve({ changes: preview.changes, enablesAuto: false }),
          () => business.updateInfo(actor, location_id, patch),
        );
      }),
  );

  server.registerTool(
    "update_business_reply_settings",
    {
      title: "Change a location's review reply settings (needs confirmation)",
      description:
        "Change how a location answers Google reviews: per-rating mode (auto, approval or manual) and template (template_id, null for AI-written), voice, personalize, escalate low ratings to Slack, safety pause, daily automatic limit, quiet hours (null to turn off) and placeholder values like team_name, phone or support_email (merged; empty string clears one). Only send what changes. Two steps with confirm_token. Turning a rating to auto needs the owner to allow agents to post.",
      inputSchema: {
        location_id: locationId,
        rating_rules: z
          .array(
            z.object({
              rating: z.number().int().min(1).max(5),
              mode: z.enum(["auto", "approval", "manual"]),
              template_id: z.string().uuid().nullable(),
            }),
          )
          .max(5)
          .optional(),
        tone: z.enum(["friendly", "professional", "concise"]).optional(),
        personalize: z.boolean().optional(),
        escalate: z.boolean().optional(),
        auto_pause: z.boolean().optional(),
        daily_auto_limit: z.number().int().min(0).max(500).optional(),
        quiet_hours: z
          .object({
            start: z.string().regex(/^\d{2}:\d{2}$/),
            end: z.string().regex(/^\d{2}:\d{2}$/),
          })
          .nullable()
          .optional(),
        placeholders: z.record(z.string(), z.string().max(200)).optional(),
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
      run(() => {
        const settings = Object.fromEntries(
          Object.entries({
            tone: a.tone,
            personalize: a.personalize,
            escalate: a.escalate,
            autoPause: a.auto_pause,
            dailyAutoLimit: a.daily_auto_limit,
            quietHours: a.quiet_hours,
          }).filter(([, v]) => v !== undefined),
        );
        const update: LocationUpdate = {
          ...(Object.keys(settings).length ? { settings } : {}),
          ...(a.rating_rules
            ? {
                ratingRules: a.rating_rules.map((r) => ({
                  rating: r.rating,
                  mode: r.mode,
                  templateId: r.template_id,
                })),
              }
            : {}),
          ...(a.placeholders ? { variables: a.placeholders } : {}),
        };
        return confirmed(
          "update_business_reply_settings",
          a,
          confirm_token,
          () => business.previewLocation(ws, a.location_id, update),
          () => business.updateLocation(actor, a.location_id, update),
        );
      }),
  );

  server.registerTool(
    "sync_business",
    {
      title: "Sync Google Business",
      description:
        "Fetch new Google reviews for every location, draft replies by the owner's rules and pick up locations newly added to the Google account.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    () => run(() => business.syncAll(actor)),
  );
}
