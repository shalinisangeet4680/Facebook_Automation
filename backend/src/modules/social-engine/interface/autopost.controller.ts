import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiDefaultResponse,
  ApiExcludeEndpoint,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyReply, FastifyRequest } from "fastify";

import { AppConfig, cookieOptions } from "@shared/config/app-config";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { Public } from "@shared/security/public.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { SocialAccountsService } from "../application/social-accounts.service";
import { SocialCommentsService } from "../application/social-comments.service";
import { SocialContentService } from "../application/social-content.service";
import { SocialActor } from "../application/social-engine.service";
import { SocialInsightsService } from "../application/social-insights.service";
import {
  COMMENT_CLASSES,
  CommentClass,
  POST_STATUSES,
  PostStatus,
} from "../domain/social.types";
import {
  AutopostAccountDetailDto,
  AutopostAccountListDto,
  AutopostApproveAllResultDto,
  AutopostApproveRepliesResultDto,
  AutopostCalendarDto,
  AutopostCheckDto,
  AutopostCommentDto,
  AutopostCommentListDto,
  AutopostConnectUrlDto,
  AutopostInsightsDto,
  AutopostPlanListDto,
  AutopostPlanResultDto,
  AutopostPostDto,
  AutopostPostListDto,
  AutopostStatusDto,
  AutopostSyncResultDto,
  AutopostWrittenDto,
  BestTimesDto,
  BrandKitResponseDto,
} from "./dto/autopost-response.dto";
import {
  ApproveAutopostsDto,
  AutopostApproveRepliesDto,
  AutopostApproveReplyDto,
  AutopostCalendarQueryDto,
  AutopostCommentAiDraftDto,
  AutopostCommentTextDto,
  AutopostCommentsQueryDto,
  AutopostHideCommentDto,
  AutopostInsightsQueryDto,
  AutopostOAuthCallbackQueryDto,
  AutopostPlansQueryDto,
  AutopostPlatformQueryDto,
  AutopostPostsQueryDto,
  BrandKitPatchDto,
  BrandKitQueryDto,
  CreateAutopostDto,
  GeneratePlanDto,
  PrefillBrandKitDto,
  RegenerateAutopostDto,
  StartAutopostOAuthDto,
  UpdateAutopostAccountDto,
  UpdateAutopostDto,
  WriteAutopostDto,
} from "./dto/autopost.dto";

export const AUTOPOST_STATE_COOKIE = "tv_autopost_state";
const STATE_PATH = "/api/v1/autopost/oauth";
const HOUR = 3_600_000;

const actor = (ctx: TenantContext): SocialActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

const id = new ParseUUIDPipe();

const list = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
) =>
  raw
    ? (raw
        .split(",")
        .filter((s) => (allowed as readonly string[]).includes(s)) as T[])
    : undefined;

@ApiTags("Instagram and Facebook Autopost")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("autopost")
export class AutopostController {
  constructor(
    private readonly accounts: SocialAccountsService,
    private readonly content: SocialContentService,
    private readonly comments: SocialCommentsService,
    private readonly insights: SocialInsightsService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  @Get("status")
  status(): AutopostStatusDto {
    return this.accounts.status();
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post("oauth/start")
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() ctx: TenantContext,
    @Body() body: StartAutopostOAuthDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): AutopostConnectUrlDto {
    const started = this.accounts.start(actor(ctx), body);
    void reply.setCookie(AUTOPOST_STATE_COOKIE, started.nonce, {
      ...cookieOptions(this.config),
      httpOnly: true,
      sameSite: "lax",
      path: STATE_PATH,
      maxAge: started.ttlSeconds,
    });
    return { url: started.url };
  }

  @Public()
  @ApiExcludeEndpoint()
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Get("oauth/callback")
  async callback(
    @Query() query: AutopostOAuthCallbackQueryDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const url = await this.accounts.callback(
      query,
      request.cookies?.[AUTOPOST_STATE_COOKIE],
    );
    void reply.clearCookie(AUTOPOST_STATE_COOKIE, {
      ...cookieOptions(this.config),
      path: STATE_PATH,
    });
    await reply.redirect(url, 302);
  }

  @Get("accounts")
  accountList(
    @CurrentUser() ctx: TenantContext,
    @Query() q: AutopostPlatformQueryDto,
  ): Promise<AutopostAccountListDto> {
    return this.accounts.accounts(ctx.workspaceId, q.platform);
  }

  @Get("accounts/:id")
  account(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) accountId: string,
  ): Promise<AutopostAccountDetailDto> {
    return this.accounts.account(ctx.workspaceId, accountId);
  }

  @Put("accounts/:id")
  updateAccount(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) accountId: string,
    @Body() body: UpdateAutopostAccountDto,
  ): Promise<AutopostAccountDetailDto> {
    return this.accounts.updateAccount(actor(ctx), accountId, body);
  }

  @Post("accounts/:id/resume")
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) accountId: string,
  ): Promise<AutopostAccountDetailDto> {
    return this.accounts.resume(actor(ctx), accountId);
  }

  @Delete("accounts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAccount(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) accountId: string,
  ): Promise<void> {
    return this.accounts.remove(actor(ctx), accountId);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Post("accounts/:id/sync")
  @HttpCode(HttpStatus.OK)
  sync(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) accountId: string,
  ): Promise<AutopostSyncResultDto> {
    return this.accounts.sync(actor(ctx), accountId);
  }

  @Get("accounts/:id/best-times")
  bestTimes(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) accountId: string,
  ): Promise<BestTimesDto> {
    return this.insights.bestTimes(ctx.workspaceId, accountId);
  }

  @Get("brand-kit")
  brandKit(
    @CurrentUser() ctx: TenantContext,
    @Query() q: BrandKitQueryDto,
  ): Promise<BrandKitResponseDto> {
    return this.content.brandKit(ctx.workspaceId, q.accountId);
  }

  @Put("brand-kit")
  saveBrandKit(
    @CurrentUser() ctx: TenantContext,
    @Query() q: BrandKitQueryDto,
    @Body() body: BrandKitPatchDto,
  ): Promise<BrandKitResponseDto> {
    return this.content.saveBrandKit(actor(ctx), q.accountId ?? null, body);
  }

  @Delete("brand-kit")
  resetBrandKit(
    @CurrentUser() ctx: TenantContext,
    @Query() q: BrandKitQueryDto,
  ): Promise<BrandKitResponseDto> {
    return q.accountId
      ? this.content.resetAccountKit(actor(ctx), q.accountId)
      : this.content.brandKit(ctx.workspaceId, null);
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post("brand-kit/prefill")
  @HttpCode(HttpStatus.OK)
  prefill(
    @CurrentUser() ctx: TenantContext,
    @Body() body: PrefillBrandKitDto,
  ): Promise<BrandKitResponseDto> {
    return this.content.prefill(actor(ctx), body);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post("plans")
  @HttpCode(HttpStatus.OK)
  plan(
    @CurrentUser() ctx: TenantContext,
    @Body() body: GeneratePlanDto,
  ): Promise<AutopostPlanResultDto> {
    return this.content.generatePlan(actor(ctx), body);
  }

  @Get("plans")
  plans(
    @CurrentUser() ctx: TenantContext,
    @Query() q: AutopostPlansQueryDto,
  ): Promise<AutopostPlanListDto> {
    return this.content.plans(ctx.workspaceId, q.platform);
  }

  @Get("calendar")
  calendar(
    @CurrentUser() ctx: TenantContext,
    @Query() q: AutopostCalendarQueryDto,
  ): Promise<AutopostCalendarDto> {
    return this.content.calendar(ctx.workspaceId, q);
  }

  @Get("posts")
  posts(
    @CurrentUser() ctx: TenantContext,
    @Query() q: AutopostPostsQueryDto,
  ): Promise<AutopostPostListDto> {
    return this.content.posts(ctx.workspaceId, {
      platform: q.platform,
      accountId: q.accountId,
      statuses: list<PostStatus>(q.status, POST_STATUSES),
      from: q.from,
      to: q.to,
      limit: q.limit,
    });
  }

  @Post("posts")
  createPost(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreateAutopostDto,
  ): Promise<AutopostPostDto> {
    return this.content.createPost(actor(ctx), body);
  }

  @Post("posts/check")
  @HttpCode(HttpStatus.OK)
  check(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreateAutopostDto,
  ): Promise<AutopostCheckDto> {
    return this.content.check(actor(ctx), body);
  }

  @Throttle({ default: { limit: 300, ttl: HOUR } })
  @Post("posts/write")
  @HttpCode(HttpStatus.OK)
  write(
    @CurrentUser() ctx: TenantContext,
    @Body() body: WriteAutopostDto,
  ): Promise<AutopostWrittenDto> {
    return this.content.write(actor(ctx), body);
  }

  @Post("posts/approve-all")
  @HttpCode(HttpStatus.OK)
  approveAll(
    @CurrentUser() ctx: TenantContext,
    @Body() body: ApproveAutopostsDto,
  ): Promise<AutopostApproveAllResultDto> {
    return this.content.approveAll(actor(ctx), body);
  }

  @Get("posts/:id")
  post(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<AutopostPostDto> {
    return this.content.view(ctx.workspaceId, postId);
  }

  @Put("posts/:id")
  updatePost(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
    @Body() body: UpdateAutopostDto,
  ): Promise<AutopostPostDto> {
    return this.content.updatePost(actor(ctx), postId, body);
  }

  @Delete("posts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  removePost(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<void> {
    return this.content.remove(actor(ctx), postId);
  }

  @Post("posts/:id/approve")
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<AutopostPostDto> {
    return this.content.approve(actor(ctx), postId);
  }

  @Post("posts/:id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<AutopostPostDto> {
    return this.content.cancel(actor(ctx), postId);
  }

  @Post("posts/:id/retry")
  @HttpCode(HttpStatus.OK)
  retry(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<AutopostPostDto> {
    return this.content.retry(actor(ctx), postId);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Post("posts/:id/publish")
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
  ): Promise<AutopostPostDto> {
    return this.content.publishNow(actor(ctx), postId);
  }

  @Throttle({ default: { limit: 300, ttl: HOUR } })
  @Post("posts/:id/regenerate")
  @HttpCode(HttpStatus.OK)
  regenerate(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) postId: string,
    @Body() body: RegenerateAutopostDto,
  ): Promise<AutopostPostDto> {
    return this.content.regenerate(actor(ctx), postId, body.part);
  }

  @Get("insights")
  insightsFor(
    @CurrentUser() ctx: TenantContext,
    @Query() q: AutopostInsightsQueryDto,
  ): Promise<AutopostInsightsDto> {
    return this.insights.insights(ctx.workspaceId, q);
  }

  @Get("comments")
  commentList(
    @CurrentUser() ctx: TenantContext,
    @Query() q: AutopostCommentsQueryDto,
  ): Promise<AutopostCommentListDto> {
    return this.comments.list(ctx.workspaceId, {
      platform: q.platform,
      accountId: q.accountId,
      filter: q.filter,
      classes: list<CommentClass>(q.classes, COMMENT_CLASSES),
      limit: q.limit,
    });
  }

  @Post("comments/:id/reply")
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) commentId: string,
    @Body() body: AutopostCommentTextDto,
  ): Promise<AutopostCommentDto> {
    return this.comments.replyNow(actor(ctx), commentId, body);
  }

  @Put("comments/:id/draft")
  draft(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) commentId: string,
    @Body() body: AutopostCommentTextDto,
  ): Promise<AutopostCommentDto> {
    return this.comments.saveDraft(actor(ctx), commentId, body);
  }

  @Throttle({ default: { limit: 300, ttl: HOUR } })
  @Post("comments/:id/ai-draft")
  @HttpCode(HttpStatus.OK)
  aiDraft(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) commentId: string,
    @Body() body: AutopostCommentAiDraftDto,
  ): Promise<AutopostCommentDto> {
    return this.comments.aiDraft(actor(ctx), commentId, body.rewrite);
  }

  @Post("comments/:id/hide")
  @HttpCode(HttpStatus.OK)
  hide(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) commentId: string,
    @Body() body: AutopostHideCommentDto,
  ): Promise<AutopostCommentDto> {
    return this.comments.hide(actor(ctx), commentId, body.hidden);
  }

  @Post("comments/:id/skip")
  @HttpCode(HttpStatus.OK)
  skip(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) commentId: string,
  ): Promise<AutopostCommentDto> {
    return this.comments.skip(actor(ctx), commentId);
  }

  @Delete("comments/:id/skip")
  unskip(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) commentId: string,
  ): Promise<AutopostCommentDto> {
    return this.comments.skip(actor(ctx), commentId, true);
  }

  @Post("comment-replies/approve-all")
  @HttpCode(HttpStatus.OK)
  approveReplies(
    @CurrentUser() ctx: TenantContext,
    @Body() body: AutopostApproveRepliesDto,
  ): Promise<AutopostApproveRepliesResultDto> {
    return this.comments.approveAll(actor(ctx), body.replyIds);
  }

  @Post("comment-replies/:id/approve")
  @HttpCode(HttpStatus.OK)
  approveReply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) replyId: string,
    @Body() body: AutopostApproveReplyDto,
  ): Promise<AutopostCommentDto> {
    return this.comments.approve(actor(ctx), replyId, body.text);
  }

  @Post("comment-replies/:id/discard")
  @HttpCode(HttpStatus.OK)
  discardReply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) replyId: string,
  ): Promise<AutopostCommentDto> {
    return this.comments.discard(actor(ctx), replyId);
  }
}
