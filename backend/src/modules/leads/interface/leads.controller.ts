import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyReply } from "fastify";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { LeadSyncService } from "../application/lead-sync.service";
import { LeadsActor, LeadsService } from "../application/leads.service";
import { LeadFilters } from "../domain/lead.types";
import {
  LeadDto,
  LeadFiltersQueryDto,
  LeadListDto,
  LeadListQueryDto,
  LeadSummaryDto,
  LeadSyncResultDto,
  UpdateLeadDto,
} from "./dto/leads.dto";

const actor = (ctx: TenantContext): LeadsActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

const filters = (q: LeadFiltersQueryDto): LeadFilters => ({
  status: q.status,
  campaignId: q.campaignId,
  q: q.q,
});

@ApiTags("Leads")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("ads/leads")
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly sync: LeadSyncService,
  ) {}

  @Get()
  list(
    @CurrentUser() ctx: TenantContext,
    @Query() query: LeadListQueryDto,
  ): Promise<LeadListDto> {
    return this.leads.list(
      ctx.workspaceId,
      filters(query),
      query.limit ?? 25,
      query.cursor,
    );
  }

  @Get("summary")
  summary(@CurrentUser() ctx: TenantContext): Promise<LeadSummaryDto> {
    return this.leads.summary(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Get("export.csv")
  @ApiProduces("text/csv")
  @Header("Cache-Control", "no-store")
  async export(
    @CurrentUser() ctx: TenantContext,
    @Query() query: LeadFiltersQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const file = await this.leads.exportCsv(actor(ctx), filters(query));
    void reply.header("Content-Type", "text/csv; charset=utf-8");
    void reply.header(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    return file.body;
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  syncNow(@CurrentUser() ctx: TenantContext): Promise<LeadSyncResultDto> {
    return this.sync.sync(ctx.workspaceId);
  }

  @Get(":id")
  get(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LeadDto> {
    return this.leads.get(ctx.workspaceId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateLeadDto,
  ): Promise<LeadDto> {
    return this.leads.update(actor(ctx), id, body);
  }
}
