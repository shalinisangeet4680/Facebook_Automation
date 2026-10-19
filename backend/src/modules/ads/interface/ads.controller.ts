import { Controller, Get, Query } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AdsService } from "../application/ads.service";
import { CustomAudienceListDto } from "./dto/audiences.dto";
import { TargetingQueryDto, TargetingResultsDto } from "./dto/targeting.dto";
import { TrackingReportDto } from "./dto/tracking.dto";

@ApiTags("Ads")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("ads")
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get("tracking")
  tracking(@CurrentUser() ctx: TenantContext): Promise<TrackingReportDto> {
    return this.ads.tracking(ctx.workspaceId);
  }

  @Get("custom-audiences")
  customAudiences(
    @CurrentUser() ctx: TenantContext,
  ): Promise<CustomAudienceListDto> {
    return this.ads.customAudiences(ctx.workspaceId);
  }

  @Get("targeting")
  targeting(
    @CurrentUser() ctx: TenantContext,
    @Query() query: TargetingQueryDto,
  ): Promise<TargetingResultsDto> {
    return this.ads.searchTargeting(
      ctx.workspaceId,
      query.type,
      query.q,
      query.country?.toUpperCase(),
    );
  }
}
