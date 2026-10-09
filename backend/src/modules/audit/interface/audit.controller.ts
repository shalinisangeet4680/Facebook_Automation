import { Controller, Get, Query } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { PageQueryDto } from "@shared/pagination/pagination";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AuditService } from "../application/audit.service";
import { AuditPageResponseDto } from "./dto/audit-response.dto";

@ApiTags("Audit")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentUser() ctx: TenantContext,
    @Query() query: PageQueryDto,
  ): Promise<AuditPageResponseDto> {
    return this.audit.list(ctx.workspaceId, query.limit, query.cursor);
  }
}
