import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { InboxService } from "../application/inbox.service";
import { InboxDto, RefreshResultDto, SuggestionDto } from "./dto/inbox.dto";

const actor = (ctx: TenantContext) => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Inbox")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("inbox")
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() ctx: TenantContext): Promise<InboxDto> {
    return this.inbox.inbox(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() ctx: TenantContext): Promise<RefreshResultDto> {
    return this.inbox.refresh(ctx.workspaceId);
  }

  @Post("suggestions/:id/apply")
  @HttpCode(HttpStatus.OK)
  apply(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SuggestionDto> {
    return this.inbox.apply(actor(ctx), id);
  }

  @Post("suggestions/:id/dismiss")
  @HttpCode(HttpStatus.OK)
  dismiss(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SuggestionDto> {
    return this.inbox.dismiss(actor(ctx), id);
  }

  @Post("suggestions/:id/snooze")
  @HttpCode(HttpStatus.OK)
  snooze(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SuggestionDto> {
    return this.inbox.snooze(actor(ctx), id);
  }
}
