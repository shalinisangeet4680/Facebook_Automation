import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { JobsService } from "../application/jobs.service";
import { JobView } from "../domain/job.types";

@ApiTags("Jobs")
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(":jobId")
  view(
    @CurrentUser() ctx: TenantContext,
    @Param("jobId") jobId: string,
  ): Promise<JobView> {
    return this.jobs.view(ctx.workspaceId, jobId);
  }
}
