import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { PageQueryDto } from "@shared/pagination/pagination";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AuditService } from "../application/audit.service";

@ApiTags("Audit")
@Controller("audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() ctx: TenantContext, @Query() query: PageQueryDto) {
    return this.audit.list(ctx.workspaceId, query.limit, query.cursor);
  }
}
