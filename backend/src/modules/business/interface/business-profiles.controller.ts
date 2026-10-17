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

import { BusinessActor } from "../application/business-engine.service";
import { BusinessProfilesService } from "../application/business-profiles.service";
import {
  CategoryQueryDto,
  CompleteVerificationDto,
  CreateGroupDto,
  CreateProfileDto,
  GoogleSearchDto,
  StartVerificationDto,
} from "./dto/business-profiles.dto";
import {
  GbpAccountDto,
  GbpAccountListDto,
  GbpCategoryListDto,
  GoogleMatchListDto,
  ProfileValidationDto,
  VerificationOptionListDto,
  VerificationStatusDto,
} from "./dto/business-profiles-response.dto";
import { GbpLocationDetailDto } from "./dto/business-response.dto";

const actor = (ctx: TenantContext): BusinessActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

const id = new ParseUUIDPipe();

@ApiTags("Google Business")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("business")
export class BusinessProfilesController {
  constructor(private readonly profiles: BusinessProfilesService) {}

  @Get("accounts")
  accounts(@CurrentUser() ctx: TenantContext): Promise<GbpAccountListDto> {
    return this.profiles.accounts(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("accounts/groups")
  createGroup(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreateGroupDto,
  ): Promise<GbpAccountDto> {
    return this.profiles.createGroup(actor(ctx), body);
  }

  @Get("google/categories")
  categories(
    @CurrentUser() ctx: TenantContext,
    @Query() q: CategoryQueryDto,
  ): Promise<GbpCategoryListDto> {
    return this.profiles.categories(
      ctx.workspaceId,
      q.q ?? "",
      q.region,
      q.language,
    );
  }

  @Throttle({ default: { limit: 300, ttl: 3_600_000 } })
  @Post("google/search")
  @HttpCode(HttpStatus.OK)
  search(
    @CurrentUser() ctx: TenantContext,
    @Body() body: GoogleSearchDto,
  ): Promise<GoogleMatchListDto> {
    return this.profiles.search(ctx.workspaceId, {
      query: body.query,
      address: body.address ?? null,
      phone: body.phone ?? null,
      regionCode: body.regionCode ?? "IN",
    });
  }

  @Throttle({ default: { limit: 300, ttl: 3_600_000 } })
  @Post("profiles/validate")
  @HttpCode(HttpStatus.OK)
  validate(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreateProfileDto,
  ): Promise<ProfileValidationDto> {
    return this.profiles.validate(ctx.workspaceId, body);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("profiles")
  create(
    @CurrentUser() ctx: TenantContext,
    @Body() body: CreateProfileDto,
  ): Promise<GbpLocationDetailDto> {
    return this.profiles.create(actor(ctx), body);
  }

  @Get("locations/:id/verification")
  verification(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<VerificationStatusDto> {
    return this.profiles.status(ctx.workspaceId, locationId);
  }

  @Get("locations/:id/verification/options")
  verificationOptions(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
  ): Promise<VerificationOptionListDto> {
    return this.profiles.verificationOptions(ctx.workspaceId, locationId);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("locations/:id/verification")
  @HttpCode(HttpStatus.OK)
  startVerification(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
    @Body() body: StartVerificationDto,
  ): Promise<VerificationStatusDto> {
    return this.profiles.startVerification(actor(ctx), locationId, body);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("locations/:id/verification/complete")
  @HttpCode(HttpStatus.OK)
  completeVerification(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) locationId: string,
    @Body() body: CompleteVerificationDto,
  ): Promise<VerificationStatusDto> {
    return this.profiles.completeVerification(
      actor(ctx),
      locationId,
      body.code,
    );
  }
}
