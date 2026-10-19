import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";

import { Goal, GOAL_NAMES } from "@modules/ads/domain/goals";
import { AuditService } from "@modules/audit/application/audit.service";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { metaAssets } from "@modules/meta/infrastructure/meta.tables";
import { AppConfig } from "@shared/config/app-config";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { ValidationError } from "@shared/errors/domain-error";
import { TenantContext } from "@shared/tenant/tenant-context";

import {
  workspaceSettings,
  WorkspaceSettingsRow,
} from "../infrastructure/settings.tables";

export interface WorkspaceTargets {
  maxDailyBudget: number;
  monthlyBudget: number | null;
  targetCostPerResult: number | null;
}

export interface BusinessBasics {
  websiteUrl: string | null;
  offer: string | null;
  area: string | null;
  category: string | null;
  language: string | null;
}

export interface BusinessBasicsInput {
  websiteUrl: string | null;
  offer: string;
  area: string;
  category: string;
  language: string;
}

export interface GoalBudgetInput {
  goal: Goal;
  dailyBudget: number;
  monthlyBudget: number | null;
  targetCostPerResult: number | null;
}

export interface BusinessProfile {
  basics: BusinessBasics;
  basicsComplete: boolean;
  goal: Goal | null;
  budgetSet: boolean;
}

export interface SettingsView {
  workspace: { id: string; name: string };
  profile: { name: string | null; email: string | null; phone: string };
  budget: {
    currency: string;
    maxDailyBudget: number;
    platformMaxDailyBudget: number;
    monthlyBudget: number | null;
    targetCostPerResult: number | null;
    goal: Goal | null;
  };
  business: BusinessBasics;
}

export interface WorkspaceUpdate {
  name: string;
  maxDailyBudget: number;
  monthlyBudget: number | null;
  targetCostPerResult: number | null;
}

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ConfigService) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  platformMaxDailyBudget(): number {
    return this.config.get("ADS_MAX_DAILY_BUDGET", { infer: true });
  }

  async targets(workspaceId: string): Promise<WorkspaceTargets> {
    const row = await this.row(workspaceId);
    const platform = this.platformMaxDailyBudget();
    return {
      maxDailyBudget: Math.min(row?.maxDailyBudget ?? platform, platform),
      monthlyBudget: row?.monthlyBudget ?? null,
      targetCostPerResult: row?.targetCostPerResult ?? null,
    };
  }

  async profile(workspaceId: string): Promise<BusinessProfile> {
    const row = await this.row(workspaceId);
    const basics = basicsOf(row);
    return {
      basics,
      basicsComplete: Boolean(
        basics.offer && basics.area && basics.category && basics.language,
      ),
      goal: goalOf(row),
      budgetSet:
        row?.maxDailyBudget !== null && row?.maxDailyBudget !== undefined,
    };
  }

  async get(ctx: TenantContext): Promise<SettingsView> {
    const [workspace, user, targets, account, row] = await Promise.all([
      this.db.query.workspaces.findFirst({
        where: eq(workspaces.id, ctx.workspaceId),
      }),
      this.db.query.users.findFirst({ where: eq(users.id, ctx.userId) }),
      this.targets(ctx.workspaceId),
      this.db.query.metaAssets.findFirst({
        where: and(
          eq(metaAssets.workspaceId, ctx.workspaceId),
          eq(metaAssets.kind, "ad_account"),
          eq(metaAssets.isPrimary, true),
        ),
      }),
      this.row(ctx.workspaceId),
    ]);
    const currency =
      typeof account?.data.currency === "string"
        ? account.data.currency
        : "INR";
    return {
      workspace: { id: ctx.workspaceId, name: workspace?.name ?? "" },
      profile: {
        name: user?.name ?? null,
        email: user?.email ?? null,
        phone: user?.phone ?? "",
      },
      budget: {
        currency,
        ...targets,
        platformMaxDailyBudget: this.platformMaxDailyBudget(),
        goal: goalOf(row),
      },
      business: basicsOf(row),
    };
  }

  async updateWorkspace(
    ctx: TenantContext,
    input: WorkspaceUpdate,
  ): Promise<SettingsView> {
    this.checkBudget(input.maxDailyBudget, input.monthlyBudget);
    await this.db.transaction(async (tx) => {
      await tx
        .update(workspaces)
        .set({ name: input.name.trim() })
        .where(eq(workspaces.id, ctx.workspaceId));
      await tx
        .insert(workspaceSettings)
        .values({
          workspaceId: ctx.workspaceId,
          maxDailyBudget: input.maxDailyBudget,
          monthlyBudget: input.monthlyBudget,
          targetCostPerResult: input.targetCostPerResult,
        })
        .onConflictDoUpdate({
          target: workspaceSettings.workspaceId,
          set: {
            maxDailyBudget: input.maxDailyBudget,
            monthlyBudget: input.monthlyBudget,
            targetCostPerResult: input.targetCostPerResult,
          },
        });
    });
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "settings.updated",
      data: { ...input },
    });
    return this.get(ctx);
  }

  async updateBasics(
    ctx: TenantContext,
    input: BusinessBasicsInput,
  ): Promise<SettingsView> {
    const values = {
      websiteUrl: input.websiteUrl?.trim() || null,
      businessOffer: input.offer.trim(),
      businessArea: input.area.trim(),
      businessCategory: input.category.trim(),
      adLanguage: input.language.trim(),
    };
    await this.db
      .insert(workspaceSettings)
      .values({ workspaceId: ctx.workspaceId, ...values })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: values,
      });
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "settings.business_updated",
      data: { ...values },
    });
    return this.get(ctx);
  }

  async updateGoalBudget(
    ctx: TenantContext,
    input: GoalBudgetInput,
  ): Promise<SettingsView> {
    this.checkBudget(input.dailyBudget, input.monthlyBudget);
    const values = {
      mainGoal: input.goal,
      maxDailyBudget: input.dailyBudget,
      monthlyBudget: input.monthlyBudget,
      targetCostPerResult: input.targetCostPerResult,
    };
    await this.db
      .insert(workspaceSettings)
      .values({ workspaceId: ctx.workspaceId, ...values })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: values,
      });
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "settings.updated",
      data: { ...values },
    });
    return this.get(ctx);
  }

  async updateProfile(
    ctx: TenantContext,
    input: { name: string | null; email: string | null },
  ): Promise<SettingsView> {
    await this.db
      .update(users)
      .set({
        name: input.name?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
      })
      .where(eq(users.id, ctx.userId));
    return this.get(ctx);
  }

  private checkBudget(daily: number, monthly: number | null) {
    const platform = this.platformMaxDailyBudget();
    if (daily > platform) {
      throw new ValidationError(`The daily limit can be at most ${platform}.`);
    }
    if (monthly !== null && monthly < daily) {
      throw new ValidationError(
        "The monthly budget should be at least the daily limit.",
      );
    }
  }

  private async row(workspaceId: string): Promise<WorkspaceSettingsRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, workspaceId))
        .limit(1),
    );
  }
}

function basicsOf(row: WorkspaceSettingsRow | null): BusinessBasics {
  return {
    websiteUrl: row?.websiteUrl ?? null,
    offer: row?.businessOffer ?? null,
    area: row?.businessArea ?? null,
    category: row?.businessCategory ?? null,
    language: row?.adLanguage ?? null,
  };
}

function goalOf(row: WorkspaceSettingsRow | null): Goal | null {
  const goal = row?.mainGoal;
  return goal && (GOAL_NAMES as string[]).includes(goal)
    ? (goal as Goal)
    : null;
}
