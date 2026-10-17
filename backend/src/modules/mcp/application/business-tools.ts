import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { BusinessActor } from "@modules/business/application/business-engine.service";
import {
  BusinessProfilesService,
  NewBusinessInput,
} from "@modules/business/application/business-profiles.service";
import { BusinessReviewsService } from "@modules/business/application/business-reviews.service";
import {
  BusinessService,
  LocationUpdate,
} from "@modules/business/application/business.service";
import { CTA_TYPES, WEEKDAYS } from "@modules/business/domain/business.types";
import { VERIFICATION_METHODS } from "@modules/business/domain/profile.types";
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
  profiles: BusinessProfilesService;
  workspaceAi: WorkspaceAiService;
  config: AppConfig;
}

export const BUSINESS_INSTRUCTIONS =
  "- Google Business Profile: list_business_locations first. list_business_reviews shows reviews needing a reply (or replied/all). Write replies as the business owner: warm, specific to what the customer said, in their language, no promises of refunds or outcomes, and never reveal private details about a customer or patient. Save drafts with save_business_review_drafts so the owner approves them in TreeVook; send_business_review_reply posts publicly and is two-step. create_business_post publishes or schedules an update, offer or event (two-step unless saved as a draft); keep posts short, useful and without phone numbers in the text (use the Call button). get_business_insights explains views, calls, website clicks and direction requests; Google publishes these with a 2–3 day delay. update_business_info changes the name, description (max 750 characters, no links), phone, website or opening hours, and update_business_reply_settings changes per-rating reply modes, voice and safeguards; both are two-step. To add a business that isn't on TreeVook yet: find_business_on_google first; if Google already lists it, share the claim link instead of creating a duplicate. create_business_profile creates a new profile (two-step; it checks the details with Google before asking for confirmation). New profiles stay hidden until verified: start_business_verification lists the ways Google offers, then sends a code by the method the owner picks (two-step), and complete_business_verification submits the code they receive (two-step).";

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

  server.registerTool(
    "find_business_on_google",
    {
      title: "Find a business on Google Maps",
      description:
        "Search Google Maps for an existing listing by name, with an optional address or phone to narrow it down. Use this before create_business_profile to avoid duplicates. claim_url opens Google's request-access flow for a listing someone else manages; managed_in_treevook is the location id when it is already connected.",
      inputSchema: {
        name: z.string().min(2).max(100),
        address: z.string().max(200).optional(),
        phone: z.string().max(40).optional(),
        region_code: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .default("IN"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (a) =>
      run(async () => {
        const found = await deps.profiles.search(ws, {
          query: a.name,
          address: a.address ?? null,
          phone: a.phone ?? null,
          regionCode: a.region_code,
        });
        return {
          matches: found.data.map((m) => ({
            title: m.title,
            address: m.address,
            phone: m.phone,
            category: m.category,
            maps_url: m.mapsUri,
            claim_url: m.requestAdminRightsUri,
            managed_in_treevook: m.locationId,
          })),
          next: found.data.length
            ? "If one of these is the business, share its claim_url (or open it in TreeVook if managed_in_treevook is set) instead of creating a new profile."
            : "Nothing matched. create_business_profile can add it.",
          create_url: url("/create"),
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

  const profiles = deps.profiles;
  const writeOpen = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } as const;

  server.registerTool(
    "create_business_profile",
    {
      title: "Create a Google Business Profile (needs confirmation)",
      description:
        "Create a new Business Profile on Google and connect it to TreeVook. Call find_business_on_google first. category is matched against Google's category list (for example 'Dental clinic'). Give address for a storefront customers visit, or service_areas (cities or areas) for a business that goes to customers; the address is then hidden. hours is the full week (days left out are closed). website must be https. account is only needed when the owner has several Business Profile accounts. Two steps: the first call checks the details with Google and returns a summary and confirm_token; call again with the same arguments and confirm_token after the user agrees. The new profile stays hidden on Google until it is verified.",
      inputSchema: {
        name: z.string().min(1).max(100),
        category: z.string().min(2).max(80),
        additional_categories: z.array(z.string().max(80)).max(9).optional(),
        phone: z.string().max(40).optional(),
        website: z.string().url().optional(),
        description: z.string().max(750).optional(),
        address: z
          .object({
            street: z.string().min(1).max(120),
            street2: z.string().max(120).optional(),
            city: z.string().min(1).max(80),
            state: z.string().max(80).default(""),
            postal_code: z.string().min(1).max(20),
            country: z
              .string()
              .regex(/^[A-Z]{2}$/)
              .default("IN"),
          })
          .optional(),
        service_areas: z.array(z.string().min(1).max(120)).max(20).optional(),
        service_country: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .default("IN"),
        hours: z
          .array(
            z.object({
              day: z.enum(WEEKDAYS),
              open: z.string().regex(/^\d{2}:\d{2}$/),
              close: z.string().regex(/^\d{2}:\d{2}$/),
            }),
          )
          .max(28)
          .optional(),
        account: z
          .string()
          .regex(/^accounts\/\d+$/)
          .optional(),
        confirm_token: z.string().optional(),
      },
      annotations: writeOpen,
    },
    ({ confirm_token, ...a }) =>
      run(async () => {
        const region = a.address?.country ?? a.service_country;
        const pick = async (text: string) => {
          const found = (await profiles.categories(ws, text, region)).data;
          return (
            found.find(
              (c) => c.displayName.toLowerCase() === text.trim().toLowerCase(),
            ) ??
            found[0] ??
            null
          );
        };
        const primary = await pick(a.category);
        if (!primary)
          return {
            status: "invalid",
            problems: [
              `Google has no category like "${a.category}". Try a simpler word, like "Dentist" or "Bakery".`,
            ],
          };
        const extra = [];
        for (const c of a.additional_categories ?? []) {
          const found = await pick(c);
          if (found) extra.push(found);
        }
        const input: NewBusinessInput = {
          title: a.name,
          primaryCategory: primary,
          additionalCategories: extra,
          phone: a.phone ?? null,
          website: a.website ?? null,
          description: a.description ?? "",
          address: a.address
            ? {
                lines: [a.address.street, a.address.street2 ?? ""],
                locality: a.address.city,
                region: a.address.state,
                postalCode: a.address.postal_code,
                country: a.address.country,
              }
            : null,
          serviceArea: a.service_areas?.length
            ? { regionCode: a.service_country, places: a.service_areas }
            : null,
          hours: a.hours ?? [],
        };
        const target = { account: a.account ?? null };
        const check = await profiles.validate(ws, {
          ...target,
          business: input,
        });
        if (!check.valid)
          return { status: "invalid", problems: check.problems };
        const result = await confirmed(
          "create_business_profile",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                "Create this Business Profile on Google:",
                ...check.summary,
              ],
              enablesAuto: false,
            }),
          async () => {
            const location = await profiles.create(actor, {
              ...target,
              business: input,
            });
            return {
              location_id: location.id,
              title: location.title,
              verification_state: location.verificationState,
              next: "Run start_business_verification so Google shows the profile.",
              url: url(`/${location.id}`),
            };
          },
        );
        return result;
      }),
  );

  const statusView = (
    s: Awaited<ReturnType<BusinessProfilesService["status"]>>,
  ) => ({
    location_id: s.locationId,
    title: s.title,
    verified: s.verified,
    state: s.state,
    method: s.method,
    sent_to: s.target,
    needs_code: s.needsCode,
    note: s.note,
    manage_url: s.manageUrl,
  });

  server.registerTool(
    "start_business_verification",
    {
      title: "Verify a Google Business Profile (needs confirmation)",
      description:
        "Start Google's verification for an unverified location. Without method it returns the current status and the ways Google offers (text message, phone call, email, postcard, sometimes instant). With method it is two-step: the first call returns a summary and confirm_token, the second (same arguments plus confirm_token, after the owner agrees) asks Google to send the code. email is only for EMAIL when Google lets the owner pick the address at the website's domain.",
      inputSchema: {
        location_id: locationId,
        method: z.enum(VERIFICATION_METHODS).optional(),
        email: z.string().email().optional(),
        confirm_token: z.string().optional(),
      },
      annotations: writeOpen,
    },
    ({ confirm_token, ...a }) =>
      run(async () => {
        const status = await profiles.status(ws, a.location_id);
        if (status.verified)
          return {
            status: "already_verified",
            verification: statusView(status),
          };
        const options = (await profiles.verificationOptions(ws, a.location_id))
          .data;
        const ways = options.map((o) => ({
          method: o.method,
          label: o.label,
          sends_code_to: o.phone ?? o.email ?? o.address,
          email_editable: o.emailEditable,
        }));
        if (!a.method)
          return {
            status: "choose_method",
            verification: statusView(status),
            options: ways,
            message: ways.length
              ? "Ask the owner which way they want to receive the code."
              : `Google needs another way to verify this business, such as a short video. Finish it in Business Profile: ${status.manageUrl}`,
          };
        const option = options.find((o) => o.method === a.method);
        if (!option)
          return {
            status: "invalid",
            problems: ["Google doesn't offer that method here."],
            options: ways,
          };
        const to = a.email ?? option.phone ?? option.email ?? option.address;
        return confirmed(
          "start_business_verification",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                `Ask Google to verify ${status.title} by ${option.label.toLowerCase()}${to ? ` (${to})` : ""}.`,
              ],
              enablesAuto: false,
            }),
          async () =>
            statusView(
              await profiles.startVerification(actor, a.location_id, {
                method: a.method!,
                email: a.email ?? null,
              }),
            ),
        );
      }),
  );

  server.registerTool(
    "complete_business_verification",
    {
      title: "Enter a Google verification code (needs confirmation)",
      description:
        "Submit the code Google sent by text, call, email or postcard for a location whose verification was started. Two steps with confirm_token. A wrong code returns an error; the owner can try again or start a new verification.",
      inputSchema: {
        location_id: locationId,
        code: z.string().min(4).max(12),
        confirm_token: z.string().optional(),
      },
      annotations: { ...writeOpen, idempotentHint: true },
    },
    ({ confirm_token, ...a }) =>
      run(async () => {
        const status = await profiles.status(ws, a.location_id);
        if (status.verified)
          return {
            status: "already_verified",
            verification: statusView(status),
          };
        if (!status.needsCode)
          return {
            status: "no_pending_code",
            verification: statusView(status),
            message:
              "Start verification first with start_business_verification.",
          };
        return confirmed(
          "complete_business_verification",
          a,
          confirm_token,
          () =>
            Promise.resolve({
              changes: [
                `Submit code ${a.code} to Google to verify ${status.title}.`,
              ],
              enablesAuto: false,
            }),
          async () =>
            statusView(
              await profiles.completeVerification(actor, a.location_id, a.code),
            ),
        );
      }),
  );
}
