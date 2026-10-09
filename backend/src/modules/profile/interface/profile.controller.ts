import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { ProfileService } from "../application/profile.service";
import {
  ApplyFacebookDto,
  ApplyFacebookResponseDto,
  ProfileCheckupDto,
  ProfileDraftDto,
  SaveProfileDraftDto,
} from "./dto/profile.dto";

const actor = (ctx: TenantContext) => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Profile")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  checkup(@CurrentUser() ctx: TenantContext): Promise<ProfileCheckupDto> {
    return this.profile.checkup(ctx.workspaceId);
  }

  @Put("draft")
  saveDraft(
    @CurrentUser() ctx: TenantContext,
    @Body() body: SaveProfileDraftDto,
  ): Promise<ProfileDraftDto> {
    return this.profile.saveDraft(actor(ctx), body);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("facebook/apply")
  @HttpCode(HttpStatus.OK)
  apply(
    @CurrentUser() ctx: TenantContext,
    @Body() body: ApplyFacebookDto,
  ): Promise<ApplyFacebookResponseDto> {
    return this.profile.applyFacebook(actor(ctx), body.parts);
  }
}
