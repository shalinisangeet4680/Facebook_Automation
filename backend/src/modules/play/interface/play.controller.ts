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
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { PlayActor } from "../application/play-engine.service";
import { PlayService, RuleInput } from "../application/play.service";
import {
  AddPlayAppDto,
  ApproveReplyDto,
  BulkReplyDto,
  ConnectPlayDto,
  PreviewDto,
  ReplaceRulesDto,
  ReplyDto,
  ReviewQueryDto,
  TemplateDto,
  UpdatePlayAppDto,
} from "./dto/play.dto";
import {
  BulkReplyResultDto,
  PlayAppDetailDto,
  PlayAppListDto,
  PlayConnectionDto,
  PlayConnectionListDto,
  PlayReviewDto,
  PlayReviewListDto,
  PlayRuleListDto,
  PlayTemplateDto,
  PlayTemplateListDto,
  ReplyPreviewDto,
  RestoredPresetsDto,
  SyncResultDto,
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
  constructor(private readonly play: PlayService) {}

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
  ): Promise<PlayConnectionDto> {
    return this.play.connect(actor(ctx), body.key);
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

  @Post("templates/presets")
  @HttpCode(HttpStatus.OK)
  restorePresets(
    @CurrentUser() ctx: TenantContext,
  ): Promise<RestoredPresetsDto> {
    return this.play.restorePresets(actor(ctx));
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
