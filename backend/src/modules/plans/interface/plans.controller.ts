import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { AdsActor } from "@modules/ads/domain/ads.types";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { ValidationError } from "@shared/errors/domain-error";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { PlanGeneratorService } from "../application/plan-generator.service";
import { PlanService } from "../application/plan.service";
import {
  GeneratedCampaignPlanDto,
  GenerateCampaignPlanDto,
} from "./dto/generate-plan.dto";
import {
  LaunchPlanDto,
  PlanDetailResponseDto,
  PlanListResponseDto,
  PlanResponseDto,
  ReplacePlanDto,
} from "./dto/plan.dto";

const actor = (ctx: TenantContext): AdsActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Campaign plans")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("campaign-plans")
export class PlansController {
  constructor(
    private readonly plans: PlanService,
    private readonly generator: PlanGeneratorService,
  ) {}

  @Get()
  list(@CurrentUser() ctx: TenantContext): Promise<PlanListResponseDto> {
    return this.plans.list(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post()
  propose(
    @CurrentUser() ctx: TenantContext,
    @Body() body: ReplacePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plans.propose(actor(ctx), body.plan);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("generate")
  generate(
    @CurrentUser() ctx: TenantContext,
    @Body() body: GenerateCampaignPlanDto,
  ): Promise<GeneratedCampaignPlanDto> {
    return this.generator.generate(actor(ctx), {
      goal: body.goal,
      dailyBudget: body.dailyBudget,
      locations: {
        countries: (body.locations.countries ?? []).map((c) => c.toUpperCase()),
        regions: (body.locations.regions ?? []).map((r) => ({
          key: r.key,
          name: r.name,
        })),
        cities: (body.locations.cities ?? []).map((c) => ({
          key: c.key,
          name: c.name,
          radiusKm: c.radiusKm ?? null,
        })),
      },
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      audienceNotes: body.audienceNotes,
      offer: body.offer,
      landingUrl: body.landingUrl,
      creative: body.creative
        ? {
            creativeId: body.creative.creativeId,
            imageUrl: body.creative.imageUrl ?? null,
            post: body.creative.post ?? null,
          }
        : undefined,
      language: body.language,
    });
  }

  @Get(":id")
  get(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PlanDetailResponseDto> {
    return this.plans.get(ctx.workspaceId, id);
  }

  @Put(":id")
  replace(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReplacePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plans.replace(actor(ctx), id, body.plan);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post(":id/create")
  @HttpCode(HttpStatus.OK)
  create(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plans.createInMeta(actor(ctx), id);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post(":id/launch")
  @HttpCode(HttpStatus.OK)
  launch(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: LaunchPlanDto,
  ): Promise<PlanResponseDto> {
    if (!body.confirm)
      throw new ValidationError("Confirm the launch to continue.");
    return this.plans.launch(actor(ctx), id);
  }

  @Post(":id/discard")
  @HttpCode(HttpStatus.OK)
  discard(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plans.discard(actor(ctx), id);
  }
}
