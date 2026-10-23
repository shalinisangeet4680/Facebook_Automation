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
  Res,
} from "@nestjs/common";
import {
  ApiDefaultResponse,
  ApiExcludeEndpoint,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyReply } from "fastify";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { Public } from "@shared/security/public.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { BusinessActor } from "../application/business-engine.service";
import { BusinessReviewsService } from "../application/business-reviews.service";
import { BusinessService } from "../application/business.service";
import {
  BusinessApproveAllDto,
  BusinessApproveDto,
  BusinessDraftDto,
  BusinessInboxQueryDto,
  BusinessRangeQueryDto,
  BusinessReplyDto,
  BusinessReviewQueryDto,
  BusinessTemplateDto,
  BusinessVisibilityDto,
  CreateGbpPostDto,
  InfoPatchDto,
  OAuthCallbackQueryDto,
  StartOAuthDto,
  PostQueryDto,
  UpdateLocationDto,
  UpdateGbpPostDto,
} from "./dto/business.dto";
import {
  BusinessAnalyticsDto,
  BusinessApproveAllResultDto,
  BusinessDashboardDto,
  BusinessInboxDto,
  BusinessInsightsDto,
  BusinessStatusDto,
  BusinessSuggestionListDto,
  ConnectUrlDto,
  GbpConnectionListDto,
  GbpLocationDetailDto,
  GbpLocationListDto,
  GbpPhotoListDto,
  GbpPostDto,
  GbpPostListDto,
  GbpReviewDto,
  GbpReviewListDto,
  GbpTemplateDto,
  GbpTemplateListDto,
  InfoPreviewDto,
  LocationDiscoveryDto,
  LocationInfoDto,
  LocationSyncResultDto,
  SyncAllResultDto,
} from "./dto/business-response.dto";

const actor = (ctx: TenantContext): BusinessActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

const id = new ParseUUIDPipe();
const stars = (s?: string) => (s ? s.split(",").map(Number) : undefined);
const range = (q: BusinessRangeQueryDto) => ({
  days: q.days,
  from: q.from,
  to: q.to,
  all: q.all === "true",
});

@ApiTags("Google Business")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("business")
export class BusinessController {
  constructor(
    private readonly business: BusinessService,
    private readonly reviews: BusinessReviewsService,
  ) {}

  @Get("status")
  status(): BusinessStatusDto {
    return this.business.status();
  }

  @Get("dashboard")
  dashboard(@CurrentUser() ctx: TenantContext): Promise<BusinessDashboardDto> {
    return this.business.dashboard(ctx.workspaceId);
  }

  @Get("connections")
  connections(
    @CurrentUser() ctx: TenantContext,
  ): Promise<GbpConnectionListDto> {
    return this.business.connections(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("oauth/start")
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() ctx: TenantContext,
    @Body() body: StartOAuthDto,
  ): ConnectUrlDto {
    return this.business.connectUrl(actor(ctx), body?.origin);
  }

  @Public()
  @ApiExcludeEndpoint()
  @Get("oauth/callback")
  async callback(
    @Query() query: OAuthCallbackQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const url = await this.business.callback(query);
    await reply.redirect(url, 302);
  }

  @Delete("connections/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) connectionId: string,
  ): Promise<void> {
    return this.business.disconnect(actor(ctx), connectionId);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post("discover")
  @HttpCode(HttpStatus.OK)
  discover(@CurrentUser() ctx: TenantContext): Promise<LocationDiscoveryDto> {
    return this.business.discover(actor(ctx));
  }

  @Get("locations")
  locations(@CurrentUser() ctx: TenantContext): Promise<GbpLocationListDto> {
    return this.business.locations(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("locations/sync")
  @HttpCode(HttpStatus.OK)
  syncAll(@CurrentUser() ctx: TenantContext): Promise<SyncAllResultDto> {
    return this.business.syncAll(actor(ctx));
  }

  @Get("locations/:id")
  location(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<GbpLocationDetailDto> {
    return this.business.location(ctx.workspaceId, locationId);
  }

  @Put("locations/:id")
  updateLocation(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
    @Body() body: UpdateLocationDto,
  ): Promise<GbpLocationDetailDto> {
    return this.business.updateLocation(actor(ctx), locationId, body);
  }

  @Delete("locations/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLocation(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<void> {
    return this.business.remove(actor(ctx), locationId);
  }

  @Throttle({ default: { limit: 600, ttl: 3_600_000 } })
  @Post("locations/:id/sync")
  @HttpCode(HttpStatus.OK)
  sync(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<LocationSyncResultDto> {
    return this.business.sync(actor(ctx), locationId);
  }

  @Get("locations/:id/reviews")
  locationReviews(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
    @Query() q: BusinessReviewQueryDto,
  ): Promise<GbpReviewListDto> {
    return this.reviews.reviews(ctx.workspaceId, locationId, {
      state: q.state,
      stars: stars(q.stars),
    });
  }

  @Get("locations/:id/variable-suggestions")
  suggestions(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<BusinessSuggestionListDto> {
    return this.business.variableSuggestions(ctx.workspaceId, locationId);
  }

  @Get("locations/:id/info")
  info(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<LocationInfoDto> {
    return this.business.info(ctx.workspaceId, locationId);
  }

  @Get("locations/:id/photos")
  photos(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<GbpPhotoListDto> {
    return this.business.photos(ctx.workspaceId, locationId);
  }

  @Post("locations/:id/info/preview")
  @HttpCode(HttpStatus.OK)
  previewInfo(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
    @Body() body: InfoPatchDto,
  ): Promise<InfoPreviewDto> {
    return this.business.previewInfo(ctx.workspaceId, locationId, body);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Put("locations/:id/info")
  updateInfo(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
    @Body() body: InfoPatchDto,
  ): Promise<LocationInfoDto> {
    return this.business.updateInfo(actor(ctx), locationId, body);
  }

  @Get("inbox")
  inbox(
    @CurrentUser() ctx: TenantContext,
    @Query() q: BusinessInboxQueryDto,
  ): Promise<BusinessInboxDto> {
    return this.reviews.inbox(
      ctx.workspaceId,
      q.filter ?? "pending",
      q.locationId,
      stars(q.stars),
    );
  }

  @Get("analytics")
  analytics(
    @CurrentUser() ctx: TenantContext,
    @Query() q: BusinessRangeQueryDto,
  ): Promise<BusinessAnalyticsDto> {
    return this.reviews.analytics(ctx.workspaceId, q.locationId, range(q));
  }

  @Get("insights")
  insights(
    @CurrentUser() ctx: TenantContext,
    @Query() q: BusinessRangeQueryDto,
  ): Promise<BusinessInsightsDto> {
    return this.business.insights(ctx.workspaceId, q.locationId, range(q));
  }

  @Post("reviews/:id/reply")
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
    @Body() body: BusinessReplyDto,
  ): Promise<GbpReviewDto> {
    return this.reviews.replyNow(actor(ctx), reviewId, body);
  }

  @Put("reviews/:id/draft")
  saveDraft(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
    @Body() body: BusinessReplyDto,
  ): Promise<GbpReviewDto> {
    return this.reviews.saveDraft(actor(ctx), reviewId, {
      text: body.text,
      source: "manual",
    });
  }

  @Throttle({ default: { limit: 300, ttl: 3_600_000 } })
  @Post("reviews/:id/ai-draft")
  @HttpCode(HttpStatus.OK)
  aiDraft(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
    @Body() body: BusinessDraftDto,
  ): Promise<GbpReviewDto> {
    return this.reviews.draft(actor(ctx), reviewId, Boolean(body.rewrite));
  }

  @Post("reviews/:id/skip")
  @HttpCode(HttpStatus.OK)
  skip(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<GbpReviewDto> {
    return this.reviews.skip(actor(ctx), reviewId);
  }

  @Delete("reviews/:id/skip")
  unskip(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<GbpReviewDto> {
    return this.reviews.unskip(actor(ctx), reviewId);
  }

  @Delete("reviews/:id/reply")
  deleteReply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) reviewId: string,
  ): Promise<GbpReviewDto> {
    return this.reviews.deleteReply(actor(ctx), reviewId);
  }

  @Post("replies/approve-all")
  @HttpCode(HttpStatus.OK)
  approveAll(
    @CurrentUser() ctx: TenantContext,
    @Body() body: BusinessApproveAllDto,
  ): Promise<BusinessApproveAllResultDto> {
    return this.reviews.approveAll(actor(ctx), body.replyIds);
  }

  @Post("replies/:id/approve")
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) replyId: string,
    @Body() body: BusinessApproveDto,
  ): Promise<GbpReviewDto> {
    return this.reviews.approve(actor(ctx), replyId, body.text);
  }

  @Post("replies/:id/discard")
  @HttpCode(HttpStatus.OK)
  discard(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) replyId: string,
  ): Promise<GbpReviewDto> {
    return this.reviews.discard(actor(ctx), replyId);
  }

  @Get("templates")
  templates(
    @CurrentUser() ctx: TenantContext,
    @Query() q: PostQueryDto,
  ): Promise<GbpTemplateListDto> {
    return this.business.templates(ctx.workspaceId, q.locationId);
  }

  @Post("templates")
  createTemplate(
    @CurrentUser() ctx: TenantContext,
    @Body() body: BusinessTemplateDto,
  ): Promise<GbpTemplateDto> {
    return this.business.createTemplate(actor(ctx), body);
  }

  @Put("templates/:id")
  updateTemplate(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) templateId: string,
    @Body() body: BusinessTemplateDto,
  ): Promise<GbpTemplateDto> {
    return this.business.updateTemplate(actor(ctx), templateId, body);
  }

  @Put("templates/:id/visibility")
  templateVisibility(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) templateId: string,
    @Body() body: BusinessVisibilityDto,
  ): Promise<GbpTemplateDto> {
    return this.business.setTemplateHidden(actor(ctx), templateId, body.hidden);
  }

  @Delete("templates/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) templateId: string,
  ): Promise<void> {
    return this.business.deleteTemplate(actor(ctx), templateId);
  }

  @Get("posts")
  posts(
    @CurrentUser() ctx: TenantContext,
    @Query() q: PostQueryDto,
  ): Promise<GbpPostListDto> {
    return this.business.posts(ctx.workspaceId, q.locationId);
  }

  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @Post("posts")
  createPost(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreateGbpPostDto,
  ): Promise<GbpPostDto> {
    return this.business.createPost(actor(ctx), body);
  }

  @Put("posts/:id")
  updatePost(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
    @Body() body: UpdateGbpPostDto,
  ): Promise<GbpPostDto> {
    return this.business.updatePost(actor(ctx), postId, body);
  }

  @Delete("posts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePost(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<void> {
    return this.business.deletePost(actor(ctx), postId);
  }
}
