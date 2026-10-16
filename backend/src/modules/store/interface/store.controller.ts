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

import { StoreActor, StoreService } from "../application/store.service";
import {
  AddToCreativesDto,
  AddedCreativesDto,
  SaveStoreProjectDto,
  StoreChoiceDto,
  StoreProjectDetailDto,
  StoreProjectListDto,
  StoreUploadTicketDto,
} from "./dto/store.dto";

const actor = (ctx: TenantContext): StoreActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Store listing")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("store-projects")
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get()
  list(@CurrentUser() ctx: TenantContext): Promise<StoreProjectListDto> {
    return this.store.list(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post()
  save(
    @CurrentUser() ctx: TenantContext,
    @Body() body: SaveStoreProjectDto,
  ): Promise<StoreUploadTicketDto> {
    return this.store.save(actor(ctx), body);
  }

  @Get(":id")
  get(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<StoreProjectDetailDto> {
    return this.store.get(ctx.workspaceId, id);
  }

  @Put(":id/choice")
  choose(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StoreChoiceDto,
  ): Promise<StoreProjectDetailDto> {
    return this.store.choose(actor(ctx), id, body);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post(":id/creatives")
  addToCreatives(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AddToCreativesDto,
  ): Promise<AddedCreativesDto> {
    return this.store.addToCreatives(actor(ctx), id, body.assetIds);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.store.remove(actor(ctx), id);
  }
}
