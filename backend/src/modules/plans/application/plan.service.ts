import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AdsService } from "@modules/ads/application/ads.service";
import { AdsActor, DraftInput } from "@modules/ads/domain/ads.types";
import {
  CALLS_TO_ACTION,
  CONVERSION_EVENTS,
  GOALS,
  LEAD_FORM_CALLS_TO_ACTION,
} from "@modules/ads/domain/goals";
import {
  customQuestionKey,
  LEAD_FORM_LOCALES,
  LeadFormSpec,
} from "@modules/ads/domain/lead-form";
import { AuditService } from "@modules/audit/application/audit.service";
import {
  LeadSyncService,
  TrackFormInput,
} from "@modules/leads/application/lead-sync.service";
import { variantLabel } from "@modules/ads/domain/variants";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { AssetView } from "@modules/meta/domain/meta.types";
import { SettingsService } from "@modules/settings/application/settings.service";
import { AppConfig, appUrl } from "@shared/config/app-config";
import {
  CodedError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

import { CampaignPlan, parsePlan } from "../domain/plan.schema";
import {
  PlanAdAccount,
  PlanMeta,
  PlanSummaryView,
  PlanView,
} from "../domain/plan.types";
import { PlanRepository } from "../infrastructure/plan.repository";
import {
  CampaignPlanRow,
  CampaignPlanStatus,
} from "../infrastructure/plans.tables";

const conflict = (message: string) =>
  new CodedError(ErrorCode.CONFLICT, 409, message);

function accountView(
  assets: AssetView[],
  externalId: string | null,
): PlanAdAccount | null {
  const asset = externalId
    ? assets.find((a) => a.kind === "ad_account" && a.externalId === externalId)
    : assets.find((a) => a.kind === "ad_account" && a.isPrimary);
  if (!asset)
    return externalId
      ? { id: externalId, name: externalId, currency: "INR" }
      : null;
  return {
    id: asset.externalId,
    name: asset.name,
    currency:
      typeof asset.details.currency === "string"
        ? asset.details.currency
        : "INR",
  };
}

function toView(row: CampaignPlanRow, assets: AssetView[] = []): PlanView {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    plan: row.plan as unknown as CampaignPlan,
    meta: (row.meta as unknown as PlanMeta | null) ?? null,
    adAccount: row.adAccountId ? accountView(assets, row.adAccountId) : null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function draftInputFor(plan: CampaignPlan): DraftInput {
  const variants = plan.variants
    .filter((v) => v.enabled)
    .map((v, i) => ({
      label: variantLabel(i + 1),
      primaryText: v.primaryText,
      headline: v.headline,
      imageUrl: v.imageUrl ?? undefined,
      videoUrl: v.videoUrl ?? undefined,
    }));
  return {
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
      workPositions: plan.targeting.workPositions,
      industries: plan.targeting.industries,
      behaviors: plan.targeting.behaviors,
      customAudiences: plan.targeting.customAudiences,
      excludedCustomAudiences: plan.targeting.excludedCustomAudiences,
    },
    creative: {
      primaryText: plan.creative.primaryText,
      headline: plan.creative.headline,
      description: plan.creative.description ?? undefined,
      linkUrl: plan.creative.linkUrl,
      imageUrl: plan.creative.imageUrl ?? undefined,
      videoUrl: plan.creative.post
        ? undefined
        : (plan.creative.videoUrl ?? undefined),
      callToAction: plan.creative.callToAction,
      post: plan.creative.post
        ? {
            platform: plan.creative.post.platform,
            id: plan.creative.post.id,
          }
        : undefined,
    },
    ...(variants.length ? { variants } : {}),
    leadForm: plan.leadForm ?? undefined,
  };
}

function formQuestions(form: LeadFormSpec) {
  return [
    ...form.questions.map((type) => ({
      key: type === "PHONE" ? "phone_number" : type.toLowerCase(),
      label: type,
      type,
    })),
    ...form.customQuestions.map((q, i) => ({
      key: customQuestionKey(i),
      label: q.label,
      type: "CUSTOM",
    })),
  ];
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly plans: PlanRepository,
    private readonly ads: AdsService,
    private readonly connections: MetaConnectionService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly leads: LeadSyncService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  reviewUrl(id: string): string {
    return `${appUrl(this.config)}/campaigns/plans/${id}`;
  }

  async propose(
    actor: AdsActor,
    input: unknown,
    details: Record<string, unknown> = {},
  ): Promise<PlanView> {
    const plan = await this.validate(input, actor.workspaceId);
    const row = await this.plans.insert({
      workspaceId: actor.workspaceId,
      createdBy: actor.userId,
      source: actor.via,
      plan: plan as unknown as Record<string, unknown>,
    });
    await this.record(actor, "plan.proposed", row.id, {
      name: plan.name,
      ...details,
    });
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
    const currency = accountView(data, row.adAccountId)?.currency ?? "INR";
    return {
      ...toView(row, data),
      options: {
        currency,
        maxDailyBudget: (await this.settings.targets(workspaceId))
          .maxDailyBudget,
        goals: Object.entries(GOALS).map(([name, g]) => ({
          name,
          needsPixel: g.needsPixel,
          instantForm: g.instantForm,
        })),
        conversionEvents: [...CONVERSION_EVENTS],
        callsToAction: [...CALLS_TO_ACTION],
        leadFormCallsToAction: [...LEAD_FORM_CALLS_TO_ACTION],
        leadFormLocales: Object.entries(LEAD_FORM_LOCALES).map(
          ([code, name]) => ({ code, name }),
        ),
      },
    };
  }

  async progress(
    workspaceId: string,
  ): Promise<{ planned: number; createdInMeta: number }> {
    const counts = await this.plans.countByStatus(workspaceId);
    const created = (counts.created ?? 0) + (counts.launched ?? 0);
    return { planned: (counts.draft ?? 0) + created, createdInMeta: created };
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
    let createdForm: TrackFormInput | null = null;
    const view = await this.plans.transaction(async (tx) => {
      const row = await this.plans.find(actor.workspaceId, id, tx, true);
      if (!row) throw new NotFoundError("This plan doesn't exist.");
      this.expect(
        row.status,
        "draft",
        "This plan was already created in Meta.",
      );
      const plan = await this.validate(row.plan, actor.workspaceId);
      if (
        !plan.creative.imageUrl &&
        !plan.creative.videoUrl &&
        !plan.creative.post
      ) {
        throw new ValidationError(
          "Add an image or a video to the ad before creating it in Meta.",
        );
      }
      let result;
      try {
        result = await this.ads.createDraft(actor, draftInputFor(plan));
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
        adAccountId: result.adAccountId,
        ads: result.ads,
        ...(result.leadFormId ? { leadFormId: result.leadFormId } : {}),
      };
      if (result.leadFormId && plan.leadForm)
        createdForm = {
          formId: result.leadFormId,
          pageId: result.pageId,
          name: plan.leadForm.name,
          planId: row.id,
          questions: formQuestions(plan.leadForm),
        };
      await this.record(actor, "plan.created_in_meta", row.id, {
        campaignId: meta.campaignId,
        adAccountId: result.adAccountId,
        ads: result.ads.length,
        ...(meta.leadFormId ? { leadFormId: meta.leadFormId } : {}),
      });
      return this.plans.update(
        row.id,
        {
          status: "created",
          meta: meta as unknown as Record<string, unknown>,
          adAccountId: result.adAccountId,
          error: null,
        },
        tx,
      );
    });
    if (createdForm) await this.trackForm(actor.workspaceId, createdForm);
    return this.view(actor.workspaceId, view);
  }

  private async view(workspaceId: string, row: CampaignPlanRow) {
    if (!row.adAccountId) return toView(row);
    return toView(row, (await this.connections.listAssets(workspaceId)).data);
  }

  private async trackForm(workspaceId: string, form: TrackFormInput) {
    try {
      await this.leads.trackCreatedForm(workspaceId, form);
    } catch (err) {
      this.logger.warn(
        `Couldn't track lead form ${form.formId}: ${(err as Error).message}`,
      );
    }
  }

  async launch(actor: AdsActor, id: string): Promise<PlanView> {
    const row = await this.plans.transaction(async (tx) => {
      const row = await this.plans.find(actor.workspaceId, id, tx, true);
      if (!row) throw new NotFoundError("This plan doesn't exist.");
      this.expect(
        row.status,
        "created",
        "Create the campaign in Meta before launching it.",
      );
      const meta = row.meta as unknown as PlanMeta;
      const account = row.adAccountId ?? meta.adAccountId ?? undefined;
      await this.ads.launchNow(actor, meta.campaignId, account);
      await this.record(actor, "plan.launched", row.id, {
        campaignId: meta.campaignId,
        ...(account ? { adAccountId: account } : {}),
      });
      return this.plans.update(row.id, { status: "launched" }, tx);
    });
    return this.view(actor.workspaceId, row);
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
