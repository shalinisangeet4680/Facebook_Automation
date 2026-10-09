import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { AdsService } from "@modules/ads/application/ads.service";
import { AdsActor } from "@modules/ads/domain/ads.types";
import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOAL_NAMES,
} from "@modules/ads/domain/goals";
import { SCOPES } from "@modules/oauth/domain/oauth.policy";
import { PlanService } from "@modules/plans/application/plan.service";
import { planSchema } from "@modules/plans/domain/plan.schema";
import { DomainError } from "@shared/errors/domain-error";
import { McpAuth } from "@shared/security/jwt-claims";

const INSTRUCTIONS = `Ads Autopilot connects you to the user's Meta (Facebook and Instagram) ad account.

How to work:
- Start with get_account_overview to learn the ad account, currency, Page, Pixel and guardrails.
- Use get_performance for numbers. Money is in the account currency (major units, e.g. rupees). Explain results in plain language and suggest concrete next steps.
- create_campaign_draft builds the campaign, ad set and ad in Meta, all PAUSED. Nothing spends money until it is activated.
- activate and update_daily_budget are two-step. The first call returns a summary and a confirm_token. Show the summary to the user, wait for an explicit yes in this conversation, then call again with the same arguments plus confirm_token. Never confirm on the user's behalf.
- pause takes effect immediately and is always safe.
- Use search_targeting to find city, region and interest keys before drafting.
- To plan a new campaign: call get_planning_context, research the business (ask the user, read their website), then call propose_campaign_plan with every setting and a clear reason for each choice. Share the returned review link. The owner reviews, edits, creates and launches the plan in Autopilot; do not call create_campaign_draft for a proposed plan unless the user asks.
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
  ) {}

  create(auth: McpAuth, clientName: string): McpServer {
    const server = new McpServer(
      { name: "ads-autopilot", title: "Ads Autopilot", version: "1.0.0" },
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
          "Find Meta targeting keys for cities, regions, countries or interests. Use the returned key in create_campaign_draft.",
        inputSchema: {
          type: z.enum(["city", "region", "country", "interest"]),
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

    if (!auth.scopes.includes(SCOPES.WRITE)) return server;

    server.registerTool(
      "propose_campaign_plan",
      {
        title: "Propose a campaign plan",
        description:
          "Save a complete campaign plan for the owner to review in Autopilot. Fill every setting and explain each choice in reasons (goal, audience, budget, creative) using evidence from get_planning_context and the business. Use location and interest keys from search_targeting. dailyBudget is in the account currency. Leave imageUrl empty unless the user gave a public https image; describe the ideal image in imageIdea. Returns a review link to share with the user. Nothing is created in Meta by this tool.",
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

    return server;
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
