import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AdsService } from "@modules/ads/application/ads.service";
import { AdsActor } from "@modules/ads/domain/ads.types";
import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOALS,
} from "@modules/ads/domain/goals";
import { AuditService } from "@modules/audit/application/audit.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { SettingsService } from "@modules/settings/application/settings.service";
import { AppConfig, appUrl } from "@shared/config/app-config";
import {
  CodedError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

import { CampaignPlan, parsePlan } from "../domain/plan.schema";
import { PlanMeta, PlanSummaryView, PlanView } from "../domain/plan.types";
import { PlanRepository } from "../infrastructure/plan.repository";
import {
  CampaignPlanRow,
  CampaignPlanStatus,
} from "../infrastructure/plans.tables";

const conflict = (message: string) =>
  new CodedError(ErrorCode.CONFLICT, 409, message);

function toView(row: CampaignPlanRow): PlanView {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    plan: row.plan as unknown as CampaignPlan,
    meta: (row.meta as unknown as PlanMeta | null) ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PlanService {
  constructor(
    private readonly plans: PlanRepository,
    private readonly ads: AdsService,
    private readonly connections: MetaConnectionService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  reviewUrl(id: string): string {
    return `${appUrl(this.config)}/campaigns/plans/${id}`;
  }

  async propose(actor: AdsActor, input: unknown): Promise<PlanView> {
    const plan = await this.validate(input, actor.workspaceId);
    const row = await this.plans.insert({
      workspaceId: actor.workspaceId,
      createdBy: actor.userId,
      source: actor.via,
      plan: plan as unknown as Record<string, unknown>,
    });
    await this.record(actor, "plan.proposed", row.id, { name: plan.name });
    return toView(row);
  }

  async replace(
    actor: AdsActor,
    id: string,
    input: unknown,
  ): Promise<PlanView> {
    const plan = await this.validate(input, actor.workspaceId);
    return this.plans.transaction(async (tx) => {
      const row = await this.plans.find(actor.workspaceId, id, tx, true);
      if (!row) throw new NotFoundError("This plan doesn't exist.");
      this.expect(row.status, "draft", "Only draft plans can be edited.");
      return toView(
        await this.plans.update(
          row.id,
          { plan: plan as unknown as Record<string, unknown>, error: null },
          tx,
        ),
      );
    });
  }

  async get(workspaceId: string, id: string) {
    const row = await this.plans.find(workspaceId, id);
    if (!row) throw new NotFoundError("This plan doesn't exist.");
    const { data } = await this.connections.listAssets(workspaceId);
    const account = data.find((a) => a.kind === "ad_account" && a.isPrimary);
    const currency =
      typeof account?.details.currency === "string"
        ? account.details.currency
        : "INR";
    return {
      ...toView(row),
      options: {
        currency,
        maxDailyBudget: (await this.settings.targets(workspaceId))
          .maxDailyBudget,
        goals: Object.entries(GOALS).map(([name, g]) => ({
          name,
          needsPixel: g.needsPixel,
        })),
        conversionEvents: [...CONVERSION_EVENTS],
        callsToAction: [...CALLS_TO_ACTION],
      },
    };
  }

  async list(workspaceId: string): Promise<{ data: PlanSummaryView[] }> {
    const rows = await this.plans.list(workspaceId, 100);
    return {
      data: rows.map((r) => {
        const plan = r.plan as unknown as CampaignPlan;
        return {
          id: r.id,
          status: r.status,
          source: r.source,
          name: plan.name,
          goal: plan.goal,
          dailyBudget: plan.dailyBudget,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    };
  }

  async createInMeta(actor: AdsActor, id: string): Promise<PlanView> {
    return this.plans.transaction(async (tx) => {
      const row = await this.plans.find(actor.workspaceId, id, tx, true);
      if (!row) throw new NotFoundError("This plan doesn't exist.");
      this.expect(
        row.status,
        "draft",
        "This plan was already created in Meta.",
      );
      const plan = await this.validate(row.plan, actor.workspaceId);
      if (!plan.creative.imageUrl) {
        throw new ValidationError(
          "Add an image to the ad before creating it in Meta.",
        );
      }
      let result;
      try {
        result = await this.ads.createDraft(actor, {
          name: plan.name,
          goal: plan.goal as keyof typeof GOALS,
          conversionEvent: plan.conversionEvent ?? undefined,
          dailyBudget: plan.dailyBudget,
          targeting: {
            countries: plan.targeting.countries,
            regionKeys: plan.targeting.regions.map((r) => r.key),
            cities: plan.targeting.cities.map((c) => ({
              key: c.key,
              radiusKm: c.radiusKm ?? undefined,
            })),
            ageMin: plan.targeting.ageMin,
            ageMax: plan.targeting.ageMax,
            genders: plan.targeting.genders,
            interests: plan.targeting.interests,
          },
          creative: {
            primaryText: plan.creative.primaryText,
            headline: plan.creative.headline,
            description: plan.creative.description ?? undefined,
            linkUrl: plan.creative.linkUrl,
            imageUrl: plan.creative.imageUrl,
            callToAction: plan.creative.callToAction,
          },
        });
      } catch (err) {
        await this.plans.update(
          row.id,
          {
            error:
              err instanceof Error ? err.message : "Meta rejected the plan.",
          },
          tx,
        );
        throw err;
      }
      const meta: PlanMeta = {
        campaignId: result.campaignId,
        adSetId: result.adSetId,
        creativeId: result.creativeId,
        adId: result.adId,
        adsManagerUrl: result.adsManagerUrl,
      };
      await this.record(actor, "plan.created_in_meta", row.id, {
        campaignId: meta.campaignId,
      });
      return toView(
        await this.plans.update(
          row.id,
          {
            status: "created",
            meta: meta as unknown as Record<string, unknown>,
            error: null,
          },
          tx,
        ),
      );
    });
  }

  async launch(actor: AdsActor, id: string): Promise<PlanView> {
    return this.plans.transaction(async (tx) => {
      const row = await this.plans.find(actor.workspaceId, id, tx, true);
      if (!row) throw new NotFoundError("This plan doesn't exist.");
      this.expect(
        row.status,
        "created",
        "Create the campaign in Meta before launching it.",
      );
      const meta = row.meta as unknown as PlanMeta;
      await this.ads.launchNow(actor, meta.campaignId);
      await this.record(actor, "plan.launched", row.id, {
        campaignId: meta.campaignId,
      });
      return toView(
        await this.plans.update(row.id, { status: "launched" }, tx),
      );
    });
  }

  async discard(actor: AdsActor, id: string): Promise<PlanView> {
    return this.plans.transaction(async (tx) => {
      const row = await this.plans.find(actor.workspaceId, id, tx, true);
      if (!row) throw new NotFoundError("This plan doesn't exist.");
      this.expect(
        row.status,
        "draft",
        "Only draft plans can be discarded. Pause the campaign instead.",
      );
      await this.record(actor, "plan.discarded", row.id, {});
      return toView(
        await this.plans.update(row.id, { status: "discarded" }, tx),
      );
    });
  }

  private async validate(
    input: unknown,
    workspaceId: string,
  ): Promise<CampaignPlan> {
    const parsed = parsePlan(input);
    if (!parsed.ok)
      throw new ValidationError(`The plan is not valid: ${parsed.message}`);
    const max = (await this.settings.targets(workspaceId)).maxDailyBudget;
    if (parsed.plan.dailyBudget > max) {
      throw new CodedError(
        ErrorCode.BUDGET_LIMIT,
        422,
        `Daily budget ${parsed.plan.dailyBudget} is above this workspace's limit of ${max} per day in the account currency.`,
      );
    }
    const goal = GOALS[parsed.plan.goal as keyof typeof GOALS];
    if (goal.needsPixel && !parsed.plan.conversionEvent) {
      throw new ValidationError(
        `The ${parsed.plan.goal} goal needs a conversionEvent.`,
      );
    }
    return parsed.plan;
  }

  private expect(
    status: CampaignPlanStatus,
    wanted: CampaignPlanStatus,
    message: string,
  ) {
    if (status !== wanted) throw conflict(message);
  }

  private record(
    actor: AdsActor,
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
