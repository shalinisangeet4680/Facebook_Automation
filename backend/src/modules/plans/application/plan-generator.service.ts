import { Inject, Injectable, Logger } from "@nestjs/common";

import { AdsService } from "@modules/ads/application/ads.service";
import { AdsActor } from "@modules/ads/domain/ads.types";
import { GOALS, Goal } from "@modules/ads/domain/goals";
import {
  DEFAULT_PREFILL_QUESTIONS,
  localeFor,
  PrefillQuestion,
  privacyPolicyFor,
} from "@modules/ads/domain/lead-form";
import { AuditService } from "@modules/audit/application/audit.service";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import { SettingsService } from "@modules/settings/application/settings.service";
import { ValidationError } from "@shared/errors/domain-error";

import {
  buildPlan,
  clampBudget,
  draftPlanCopy,
  GenerationContext,
  LeadFormContext,
  locationNames,
  PlanLocations,
  PlanPost,
} from "../domain/plan-generation";
import {
  PLAN_AI,
  PlanAi,
  PlanAiInput,
  PlanAiPastCampaign,
  PlanAiResult,
} from "../domain/ports/plan-ai";
import { PlanService } from "./plan.service";

export interface GeneratePlanInput {
  goal: Goal;
  dailyBudget: number;
  locations: PlanLocations;
  ageMin?: number;
  ageMax?: number;
  audienceNotes?: string;
  offer: string;
  landingUrl?: string;
  creative?: {
    creativeId?: string;
    imageUrl?: string | null;
    post?: PlanPost | null;
  };
  language?: string;
  leadForm?: {
    questions?: PrefillQuestion[];
    privacyPolicyUrl?: string;
    callPhone?: string | null;
    extraQuestions?: boolean;
  };
}

export interface GeneratedPlan {
  id: string;
  name: string;
  dailyBudget: number;
  requestedDailyBudget: number;
  budgetClamped: boolean;
  currency: string;
  ai: boolean;
  usedTemplate: boolean;
}

const WEBSITE_GOALS: Goal[] = ["traffic", "sales"];
const QUOTA_ACTION = "plan.proposed";

@Injectable()
export class PlanGeneratorService {
  private readonly logger = new Logger(PlanGeneratorService.name);

  constructor(
    private readonly plans: PlanService,
    private readonly ads: AdsService,
    private readonly settings: SettingsService,
    private readonly creatives: CreativesService,
    private readonly workspaceAi: WorkspaceAiService,
    audit: AuditService,
    @Inject(PLAN_AI) private readonly ai: PlanAi,
  ) {
    workspaceAi.registerDraftCounter("plans", (workspaceId, since) =>
      audit.count(workspaceId, QUOTA_ACTION, since, { ai: true }),
    );
  }

  async generate(
    actor: AdsActor,
    request: GeneratePlanInput,
  ): Promise<GeneratedPlan> {
    this.check(request);
    const ws = actor.workspaceId;
    const account = await this.ads.account(ws);
    const [targets, profile, context, visual] = await Promise.all([
      this.settings.targets(ws),
      this.settings.profile(ws),
      this.ads.planningContext(ws).catch((err: unknown) => {
        this.logger.warn(
          `Planning context unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }),
      this.visual(ws, request.creative),
    ]);
    const linkUrl =
      request.landingUrl ??
      (account.page
        ? `https://www.facebook.com/${account.page.externalId}`
        : null);
    if (!linkUrl)
      throw new ValidationError(
        "Add the web page people should visit, or select a Facebook Page in Setup.",
      );

    const language =
      request.language?.trim() || profile.basics.language || null;
    const leadForm = GOALS[request.goal].instantForm
      ? this.leadForm(request, linkUrl, profile.basics.websiteUrl, language)
      : null;
    const budget = clampBudget(request.dailyBudget, targets.maxDailyBudget);
    const input: PlanAiInput = {
      goal: request.goal,
      offer: request.offer.trim(),
      audienceNotes: request.audienceNotes?.trim() || null,
      landingUrl: request.landingUrl ?? null,
      language,
      dailyBudget: budget.dailyBudget,
      requestedDailyBudget: request.dailyBudget,
      currency: account.currency,
      maxDailyBudget: targets.maxDailyBudget,
      targetCostPerResult: targets.targetCostPerResult,
      locations: locationNames(request.locations),
      ageMin: request.ageMin ?? null,
      ageMax: request.ageMax ?? null,
      hasVisual: Boolean(visual.imageUrl || visual.post),
      business: {
        name: account.business?.name ?? null,
        page: account.page?.name ?? null,
        instagram: account.instagram?.name ?? null,
        pixel: Boolean(account.dataset),
        pixelEvents: this.pixelEvents(context),
        website: profile.basics.websiteUrl,
        sells: profile.basics.offer,
        area: profile.basics.area,
        category: profile.basics.category,
      },
      pastCampaigns: this.pastCampaigns(context),
      leadForm: leadForm
        ? {
            questions: leadForm.questions,
            extraQuestions: request.leadForm?.extraQuestions ?? true,
            button: leadForm.button.type,
          }
        : null,
    };
    const ctx: GenerationContext = {
      input,
      locations: request.locations,
      linkUrl,
      imageUrl: visual.imageUrl,
      post: visual.post,
      leadForm,
    };

    const { copy, ai } = await this.write(ws, input);
    const interests = await this.interests(ws, copy.interests);
    const built = buildPlan(ctx, copy, interests);
    if (built.usedTemplate)
      this.logger.warn(
        `Generated plan was not valid, used the template: ${built.problem}`,
      );

    const view = await this.plans.propose(actor, built.plan, {
      generated: true,
      ai,
      usedTemplate: built.usedTemplate,
      budgetClamped: budget.clamped,
    });
    return {
      id: view.id,
      name: built.plan.name,
      dailyBudget: built.plan.dailyBudget,
      requestedDailyBudget: request.dailyBudget,
      budgetClamped: budget.clamped,
      currency: account.currency,
      ai,
      usedTemplate: built.usedTemplate,
    };
  }

  private check(request: GeneratePlanInput) {
    if (!(request.dailyBudget > 0))
      throw new ValidationError("Enter a daily budget above zero.");
    if (
      request.ageMin !== undefined &&
      request.ageMax !== undefined &&
      request.ageMin > request.ageMax
    )
      throw new ValidationError(
        "The youngest age must be lower than the oldest.",
      );
    if (!locationNames(request.locations).length)
      throw new ValidationError("Choose at least one place to show your ads.");
    if (WEBSITE_GOALS.includes(request.goal) && !request.landingUrl)
      throw new ValidationError(
        "Add the web page people should visit for this goal.",
      );
    if (request.creative?.imageUrl && request.creative.post)
      throw new ValidationError("Choose either an image or a post, not both.");
    if (GOALS[request.goal].instantForm && request.creative?.post)
      throw new ValidationError(
        "Instant form ads need an image, not an existing post.",
      );
    const questions = request.leadForm?.questions;
    if (
      questions &&
      !questions.includes("PHONE") &&
      !questions.includes("EMAIL")
    )
      throw new ValidationError(
        "Ask for a phone number or an email so you can contact the lead.",
      );
  }

  private leadForm(
    request: GeneratePlanInput,
    linkUrl: string,
    website: string | null,
    language: string | null,
  ): LeadFormContext {
    const privacyPolicyUrl =
      request.leadForm?.privacyPolicyUrl ??
      privacyPolicyFor(website ?? request.landingUrl ?? null);
    if (!privacyPolicyUrl)
      throw new ValidationError(
        "Add the link to your privacy policy. Meta shows it on every instant form.",
      );
    const phone = request.leadForm?.callPhone?.trim();
    return {
      questions: [
        ...new Set(request.leadForm?.questions ?? DEFAULT_PREFILL_QUESTIONS),
      ],
      privacyPolicyUrl,
      locale: localeFor(language),
      button: phone
        ? { type: "call", phone }
        : {
            type: "website",
            url:
              request.landingUrl ??
              (website?.startsWith("https://") ? website : null) ??
              linkUrl,
          },
    };
  }

  private async visual(
    workspaceId: string,
    creative: GeneratePlanInput["creative"],
  ): Promise<{ imageUrl: string | null; post: PlanPost | null }> {
    if (creative?.post) return { imageUrl: null, post: creative.post };
    if (creative?.creativeId) {
      const view = this.creatives.view(
        await this.creatives.get(workspaceId, creative.creativeId),
      );
      if (view.kind !== "image")
        throw new ValidationError("Choose an image, not a video.");
      if (!view.url.startsWith("https://"))
        throw new ValidationError(
          "This image isn't on a public https address yet, so Meta can't use it.",
        );
      return { imageUrl: view.url, post: null };
    }
    return { imageUrl: creative?.imageUrl ?? null, post: null };
  }

  private async write(
    workspaceId: string,
    input: PlanAiInput,
  ): Promise<{ copy: PlanAiResult; ai: boolean }> {
    const settings = await this.workspaceAi.settings(workspaceId);
    const key = this.workspaceAi.keyFrom(settings);
    if (key && (await this.workspaceAi.allowance(workspaceId, settings)) > 0) {
      try {
        return { copy: await this.ai.write(key, input), ai: true };
      } catch (err) {
        this.logger.warn(
          `AI plan failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { copy: draftPlanCopy(input), ai: false };
  }

  private async interests(
    workspaceId: string,
    hints: string[],
  ): Promise<{ id: string; name: string }[]> {
    const queries = [
      ...new Set(
        hints
          .map((h) => h.trim().slice(0, 100))
          .filter((h) => h.length >= 2)
          .map((h) => h.toLowerCase()),
      ),
    ].slice(0, 5);
    const found = await Promise.all(
      queries.map(async (q) => {
        try {
          const { results } = await this.ads.searchTargeting(
            workspaceId,
            "interest",
            q,
          );
          return (
            results.find((r) => r.name.toLowerCase() === q) ??
            results[0] ??
            null
          );
        } catch {
          return null;
        }
      }),
    );
    const out = new Map<string, { id: string; name: string }>();
    for (const r of found)
      if (r && r.key.length <= 40)
        out.set(r.key, { id: r.key, name: r.name.slice(0, 200) });
    return [...out.values()];
  }

  private pixelEvents(
    context: Awaited<ReturnType<AdsService["planningContext"]>> | null,
  ): string[] {
    const tracking = context?.tracking;
    if (!tracking || !("last7Days" in tracking)) return [];
    return (tracking.last7Days ?? []).map((e) => e.event).slice(0, 15);
  }

  private pastCampaigns(
    context: Awaited<ReturnType<AdsService["planningContext"]>> | null,
  ): PlanAiPastCampaign[] {
    return (context?.last90Days.byCampaign ?? []).slice(0, 10).map((c) => ({
      name: c.name,
      objective: c.objective,
      spend: c.spend,
      results: c.result?.count ?? 0,
      costPerResult: c.costPerResult,
    }));
  }
}
