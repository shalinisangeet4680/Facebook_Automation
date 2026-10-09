import { Controller, Get, Param } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { JobsService } from "../application/jobs.service";
import { JobResponseDto } from "./dto/job-response.dto";

@ApiTags("Jobs")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(":jobId")
  view(
    @CurrentUser() ctx: TenantContext,
    @Param("jobId") jobId: string,
  ): Promise<JobResponseDto> {
    return this.jobs.view(ctx.workspaceId, jobId);
  }
}
