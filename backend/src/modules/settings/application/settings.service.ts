import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";

import { AuditService } from "@modules/audit/application/audit.service";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { metaAssets } from "@modules/meta/infrastructure/meta.tables";
import { AppConfig } from "@shared/config/app-config";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { ValidationError } from "@shared/errors/domain-error";
import { TenantContext } from "@shared/tenant/tenant-context";

import { workspaceSettings } from "../infrastructure/settings.tables";

export interface WorkspaceTargets {
  maxDailyBudget: number;
  monthlyBudget: number | null;
  targetCostPerResult: number | null;
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
  };
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
    const row = firstOrNull(
      await this.db
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.workspaceId, workspaceId))
        .limit(1),
    );
    const platform = this.platformMaxDailyBudget();
    return {
      maxDailyBudget: Math.min(row?.maxDailyBudget ?? platform, platform),
      monthlyBudget: row?.monthlyBudget ?? null,
      targetCostPerResult: row?.targetCostPerResult ?? null,
    };
  }

  async get(ctx: TenantContext): Promise<SettingsView> {
    const [workspace, user, targets, account] = await Promise.all([
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
      },
    };
  }

  async updateWorkspace(
    ctx: TenantContext,
    input: WorkspaceUpdate,
  ): Promise<SettingsView> {
    const platform = this.platformMaxDailyBudget();
    if (input.maxDailyBudget > platform) {
      throw new ValidationError(`The daily limit can be at most ${platform}.`);
    }
    if (
      input.monthlyBudget !== null &&
      input.monthlyBudget < input.maxDailyBudget
    ) {
      throw new ValidationError(
        "The monthly budget should be at least the daily limit.",
      );
    }
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
}
