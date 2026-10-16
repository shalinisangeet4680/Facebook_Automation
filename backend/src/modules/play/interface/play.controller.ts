import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import {
  ApiBody,
  ApiConsumes,
  ApiDefaultResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { ValidationError } from "@shared/errors/domain-error";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { PlayActor } from "../application/play-engine.service";
import { PlayInboxService } from "../application/play-inbox.service";
import { PlayWorkspaceService } from "../application/play-workspace.service";
import { PlayService, RuleInput } from "../application/play.service";
import {
  AddPlayAppDto,
  AnalyticsQueryDto,
  ApproveAllDto,
  InboxQueryDto,
  WorkspaceSettingsDto,
  ApproveReplyDto,
  BulkReplyDto,
  CheckTemplateDto,
  ConnectPlayDto,
  PreviewDto,
  ReplaceRulesDto,
  ReplyDto,
  ReviewQueryDto,
  TemplateDto,
  UpdatePlayAppDto,
} from "./dto/play.dto";
import {
  AccessTokenDto,
  ApproveAllResultDto,
  InboxDto,
  InboxReviewDto,
  McpClientListDto,
  PlayAnalyticsDto,
  WorkspaceSettingsViewDto,
  BulkReplyResultDto,
  ConnectResultDto,
  DiscoveryResultDto,
  ImportResultDto,
  PlayInsightsDto,
  PlayAppDetailDto,
  PlayAppListDto,
  PlayConnectionListDto,
  PlayReviewDto,
  PlayReviewListDto,
  PlayRuleListDto,
  PlayTemplateDto,
  PlayTemplateListDto,
  ReplyPreviewDto,
  RestoredPresetsDto,
  SyncResultDto,
  TemplateCheckDto,
} from "./dto/play-response.dto";

const actor = (ctx: TenantContext): PlayActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

const id = new ParseUUIDPipe();

@ApiTags("Play reviews")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("play")
export class PlayController {
  constructor(
    private readonly play: PlayService,
    private readonly inboxes: PlayInboxService,
    private readonly workspace: PlayWorkspaceService,
  ) {}

  @Get("workspace")
  workspaceSettings(
    @CurrentUser() ctx: TenantContext,
  ): Promise<WorkspaceSettingsViewDto> {
    return this.workspace.get(ctx.workspaceId);
  }

  @Put("workspace")
  updateWorkspace(
    @CurrentUser() ctx: TenantContext,
    @Body() body: WorkspaceSettingsDto,
  ): Promise<WorkspaceSettingsViewDto> {
    return this.workspace.update(actor(ctx), body);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("workspace/token/reveal")
  @HttpCode(HttpStatus.OK)
  revealToken(@CurrentUser() ctx: TenantContext): Promise<AccessTokenDto> {
    return this.workspace.reveal(actor(ctx));
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post("workspace/token/rotate")
  @HttpCode(HttpStatus.OK)
  rotateToken(@CurrentUser() ctx: TenantContext): Promise<AccessTokenDto> {
    return this.workspace.rotate(actor(ctx));
  }

  @Get("workspace/clients")
  clients(@CurrentUser() ctx: TenantContext): Promise<McpClientListDto> {
    return this.workspace.clients(ctx);
  }

  @Delete("workspace/clients/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeClient(
    @CurrentUser() ctx: TenantContext,
    @Param("id") clientId: string,
  ): Promise<void> {
    return this.workspace.revokeClient(ctx, clientId);
  }

  @Get("inbox")
  inbox(
    @CurrentUser() ctx: TenantContext,
    @Query() query: InboxQueryDto,
  ): Promise<InboxDto> {
    return this.inboxes.inbox(
      ctx.workspaceId,
      query.filter ?? "pending",
      query.appId,
    );
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("inbox/approve-all")
  @HttpCode(HttpStatus.OK)
  approveAll(
    @CurrentUser() ctx: TenantContext,
    @Body() body: ApproveAllDto,
  ): Promise<ApproveAllResultDto> {
    return this.inboxes.approveAll(actor(ctx), body.replyIds);
  }

  @Post("reviews/:id/skip")
  @HttpCode(HttpStatus.OK)
  skip(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<InboxReviewDto> {
    return this.inboxes.skip(actor(ctx), reviewId);
  }

  @Post("reviews/:id/unskip")
  @HttpCode(HttpStatus.OK)
  unskip(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<InboxReviewDto> {
    return this.inboxes.unskip(actor(ctx), reviewId);
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("reviews/:id/draft")
  @HttpCode(HttpStatus.OK)
  draftReview(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<InboxReviewDto> {
    return this.inboxes.draft(actor(ctx), reviewId, false);
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("reviews/:id/rewrite")
  @HttpCode(HttpStatus.OK)
  rewrite(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<InboxReviewDto> {
    return this.inboxes.draft(actor(ctx), reviewId, true);
  }

  @Get("analytics")
  analytics(
    @CurrentUser() ctx: TenantContext,
    @Query() query: AnalyticsQueryDto,
  ): Promise<PlayAnalyticsDto> {
    return this.inboxes.analytics(
      ctx.workspaceId,
      query.appId,
      query.days ?? 30,
    );
  }

  @Get("connections")
  connections(
    @CurrentUser() ctx: TenantContext,
  ): Promise<PlayConnectionListDto> {
    return this.play.connections(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("connections")
  connect(
    @CurrentUser() ctx: TenantContext,
    @Body() body: ConnectPlayDto,
  ): Promise<ConnectResultDto> {
    return this.play.connect(actor(ctx), body.key);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("connections/:id/discover")
  @HttpCode(HttpStatus.OK)
  discover(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) connectionId: string,
  ): Promise<DiscoveryResultDto> {
    return this.play.discover(actor(ctx), connectionId);
  }

  @Delete("connections/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) connectionId: string,
  ): Promise<void> {
    return this.play.removeConnection(actor(ctx), connectionId);
  }

  @Get("apps")
  apps(@CurrentUser() ctx: TenantContext): Promise<PlayAppListDto> {
    return this.play.apps(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("apps")
  addApp(
    @CurrentUser() ctx: TenantContext,
    @Body() body: AddPlayAppDto,
  ): Promise<PlayAppDetailDto> {
    return this.play.addApp(actor(ctx), body);
  }

  @Get("apps/:id")
  app(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<PlayAppDetailDto> {
    return this.play.app(ctx.workspaceId, appId);
  }

  @Put("apps/:id")
  updateApp(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: UpdatePlayAppDto,
  ): Promise<PlayAppDetailDto> {
    return this.play.updateApp(actor(ctx), appId, body);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("apps/:id/recheck")
  @HttpCode(HttpStatus.OK)
  recheck(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<PlayAppDetailDto> {
    return this.play.recheck(actor(ctx), appId);
  }

  @Post("apps/:id/resume")
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<PlayAppDetailDto> {
    return this.play.resume(actor(ctx), appId);
  }

  @Delete("apps/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeApp(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<void> {
    return this.play.removeApp(actor(ctx), appId);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("apps/:id/sync")
  sync(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<SyncResultDto> {
    return this.play.syncNow(actor(ctx), appId);
  }

  @Get("apps/:id/insights")
  insights(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Query("days") days = "30",
  ): Promise<PlayInsightsDto> {
    const n = Number(days);
    if (![7, 30, 90, 365].includes(n))
      throw new ValidationError("days must be 7, 30, 90 or 365.");
    return this.play.insights(ctx.workspaceId, appId, n);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("apps/:id/import")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  async importReport(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Req() req: FastifyRequest,
  ): Promise<ImportResultDto> {
    if (!req.isMultipart())
      throw new ValidationError("Upload the report as multipart/form-data.");
    const file = await req.file({
      limits: { fileSize: 25 * 1024 * 1024 + 1, files: 1 },
    });
    if (!file) throw new ValidationError("Choose a reviews report to upload.");
    const buffer = await file.toBuffer().catch(() => {
      throw new ValidationError("Reports can be at most 25 MB.");
    });
    return this.play.importReport(actor(ctx), appId, buffer);
  }

  @Get("apps/:id/reviews")
  reviews(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Query() query: ReviewQueryDto,
  ): Promise<PlayReviewListDto> {
    const stars = query.stars
      ?.split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    return this.play.reviews(ctx.workspaceId, appId, {
      state: query.state,
      stars,
      language: query.language,
      version: query.version,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post("apps/:id/preview")
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: PreviewDto,
  ): Promise<ReplyPreviewDto> {
    return this.play.preview(
      ctx.workspaceId,
      appId,
      body.reviewId,
      body.templateId,
    );
  }

  @Post("apps/:id/reviews/:reviewId/reply")
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Param("reviewId", id) reviewId: string,
    @Body() body: ReplyDto,
  ): Promise<PlayReviewDto> {
    return this.play.replyNow(actor(ctx), appId, reviewId, body);
  }

  @Put("apps/:id/reviews/:reviewId/draft")
  saveDraft(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Param("reviewId", id) reviewId: string,
    @Body() body: ReplyDto,
  ): Promise<PlayReviewDto> {
    return this.play.saveDraft(actor(ctx), appId, reviewId, {
      text: body.text,
      templateId: body.templateId,
      source: body.templateId ? "template" : "manual",
    });
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post("apps/:id/bulk-reply")
  @HttpCode(HttpStatus.OK)
  bulkReply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: BulkReplyDto,
  ): Promise<BulkReplyResultDto> {
    return this.play.bulkReply(actor(ctx), appId, body);
  }

  @Post("replies/:id/approve")
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) replyId: string,
    @Body() body: ApproveReplyDto,
  ): Promise<PlayReviewDto> {
    return this.play.approve(actor(ctx), replyId, body.text);
  }

  @Post("replies/:id/discard")
  @HttpCode(HttpStatus.OK)
  discard(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) replyId: string,
  ): Promise<PlayReviewDto> {
    return this.play.discard(actor(ctx), replyId);
  }

  @Get("templates")
  templates(
    @CurrentUser() ctx: TenantContext,
    @Query("appId", new ParseUUIDPipe({ optional: true })) appId?: string,
  ): Promise<PlayTemplateListDto> {
    return this.play.templates(ctx.workspaceId, appId);
  }

  @Post("templates")
  createTemplate(
    @CurrentUser() ctx: TenantContext,
    @Body() body: TemplateDto,
  ): Promise<PlayTemplateDto> {
    return this.play.createTemplate(actor(ctx), body);
  }

  @Post("templates/check")
  @HttpCode(HttpStatus.OK)
  checkTemplate(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CheckTemplateDto,
  ): Promise<TemplateCheckDto> {
    return this.play.checkDraft(ctx.workspaceId, {
      bodies: body.bodies,
      appId: body.appId,
    });
  }

  @Post("templates/presets")
  @HttpCode(HttpStatus.OK)
  restorePresets(
    @CurrentUser() ctx: TenantContext,
  ): Promise<RestoredPresetsDto> {
    return this.play.restorePresets(actor(ctx));
  }

  @Post("templates/:id/duplicate")
  duplicateTemplate(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) templateId: string,
  ): Promise<PlayTemplateDto> {
    return this.play.duplicateTemplate(actor(ctx), templateId);
  }

  @Put("templates/:id")
  updateTemplate(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) templateId: string,
    @Body() body: TemplateDto,
  ): Promise<PlayTemplateDto> {
    return this.play.updateTemplate(actor(ctx), templateId, body);
  }

  @Delete("templates/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) templateId: string,
  ): Promise<void> {
    return this.play.deleteTemplate(actor(ctx), templateId);
  }

  @Get("apps/:id/rules")
  rules(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<PlayRuleListDto> {
    return this.play.rules(ctx.workspaceId, appId);
  }

  @Put("apps/:id/rules")
  replaceRules(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: ReplaceRulesDto,
  ): Promise<PlayRuleListDto> {
    return this.play.replaceRules(actor(ctx), appId, body.rules as RuleInput[]);
  }
}
