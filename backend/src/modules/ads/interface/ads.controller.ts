import { Controller, Get, Query } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AdsService } from "../application/ads.service";
import { TargetingQueryDto, TargetingResultsDto } from "./dto/targeting.dto";

@ApiTags("Ads")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("ads")
export class AdsController {
  constructor(private readonly ads: AdsService) {}

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
