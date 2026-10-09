import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { SocialService } from "../application/social.service";
import {
  ChannelsDto,
  CreatePostDto,
  LibraryDto,
  LibraryQueryDto,
  SocialPostDto,
  SocialPostListDto,
} from "./dto/social.dto";

const actor = (ctx: TenantContext) => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Social")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get("social/channels")
  channels(@CurrentUser() ctx: TenantContext): Promise<ChannelsDto> {
    return this.social.channels(ctx.workspaceId);
  }

  @Get("social/library")
  library(
    @CurrentUser() ctx: TenantContext,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryDto> {
    return this.social.library(ctx.workspaceId, query.platform);
  }

  @Get("posts")
  list(@CurrentUser() ctx: TenantContext): Promise<SocialPostListDto> {
    return this.social.list(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("posts")
  create(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreatePostDto,
  ): Promise<SocialPostDto> {
    return this.social.create(actor(ctx), body);
  }

  @Post("posts/:id/retry")
  @HttpCode(HttpStatus.OK)
  retry(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SocialPostDto> {
    return this.social.retry(actor(ctx), id);
  }

  @Post("posts/:id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SocialPostDto> {
    return this.social.cancel(actor(ctx), id);
  }
}
