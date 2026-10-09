import { Controller, Get, Query } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { ReportsService } from "../application/reports.service";
import { ReportOverviewDto, ReportQueryDto } from "./dto/report.dto";

@ApiTags("Reports")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("overview")
  overview(
    @CurrentUser() ctx: TenantContext,
    @Query() query: ReportQueryDto,
  ): Promise<ReportOverviewDto> {
    return this.reports.overview(ctx.workspaceId, query.preset ?? "last_7d");
  }
}
