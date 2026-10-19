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
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AudiencesService } from "../application/audiences.service";
import { AdsActor } from "../domain/ads.types";
import {
  SaveAudienceDto,
  SavedAudienceDto,
  SavedAudienceListDto,
} from "./dto/audiences.dto";

const actor = (ctx: TenantContext): AdsActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Ads")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("ads/audiences")
export class AudiencesController {
  constructor(private readonly audiences: AudiencesService) {}

  @Get()
  list(@CurrentUser() ctx: TenantContext): Promise<SavedAudienceListDto> {
    return this.audiences.list(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post()
  create(
    @CurrentUser() ctx: TenantContext,
    @Body() body: SaveAudienceDto,
  ): Promise<SavedAudienceDto> {
    return this.audiences.create(actor(ctx), body);
  }

  @Get(":id")
  get(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SavedAudienceDto> {
    return this.audiences.get(ctx.workspaceId, id);
  }

  @Put(":id")
  update(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: SaveAudienceDto,
  ): Promise<SavedAudienceDto> {
    return this.audiences.update(actor(ctx), id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.audiences.remove(actor(ctx), id);
  }
}
