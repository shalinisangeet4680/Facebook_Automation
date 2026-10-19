import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { ValidationError } from "@shared/errors/domain-error";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { CampaignManagerService } from "../application/campaign-manager.service";
import {
  BudgetChangeDto,
  CampaignDetailDto,
  CampaignDetailQueryDto,
  CampaignListDto,
  CampaignListQueryDto,
  CreativeChangeDto,
  SetBudgetDto,
  SetStatusDto,
  StatusChangeDto,
  UpdateAdCreativeDto,
} from "./dto/campaigns.dto";

const META_ID = /^\d{5,30}$/;

function metaId(id: string): string {
  if (!META_ID.test(id)) throw new ValidationError("That id isn't valid.");
  return id;
}

@ApiTags("Ads")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("ads")
export class CampaignsController {
  constructor(private readonly manager: CampaignManagerService) {}

  @Get("campaigns")
  list(
    @CurrentUser() ctx: TenantContext,
    @Query() query: CampaignListQueryDto,
  ): Promise<CampaignListDto> {
    return this.manager.list(
      ctx,
      query.preset ?? "last_7d",
      query.status ?? "all",
    );
  }

  @Get("campaigns/:id")
  detail(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Query() query: CampaignDetailQueryDto,
  ): Promise<CampaignDetailDto> {
    return this.manager.detail(ctx, metaId(id), query.preset ?? "last_7d");
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("campaigns/:id/status")
  @HttpCode(HttpStatus.OK)
  campaignStatus(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Body() body: SetStatusDto,
  ): Promise<StatusChangeDto> {
    return this.manager.setStatus(ctx, "campaign", metaId(id), body.status);
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("adsets/:id/status")
  @HttpCode(HttpStatus.OK)
  adSetStatus(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Body() body: SetStatusDto,
  ): Promise<StatusChangeDto> {
    return this.manager.setStatus(ctx, "adset", metaId(id), body.status);
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("ads/:id/status")
  @HttpCode(HttpStatus.OK)
  adStatus(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Body() body: SetStatusDto,
  ): Promise<StatusChangeDto> {
    return this.manager.setStatus(ctx, "ad", metaId(id), body.status);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Put("campaigns/:id/budget")
  campaignBudget(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Body() body: SetBudgetDto,
  ): Promise<BudgetChangeDto> {
    return this.manager.setBudget(
      ctx,
      "campaign",
      metaId(id),
      body.dailyBudget,
    );
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Put("adsets/:id/budget")
  adSetBudget(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Body() body: SetBudgetDto,
  ): Promise<BudgetChangeDto> {
    return this.manager.setBudget(ctx, "adset", metaId(id), body.dailyBudget);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Put("ads/:id/creative")
  adCreative(
    @CurrentUser() ctx: TenantContext,
    @Param("id") id: string,
    @Body() body: UpdateAdCreativeDto,
  ): Promise<CreativeChangeDto> {
    return this.manager.editAd(ctx, metaId(id), body);
  }
}
