import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { MetaConnectionService } from "../application/meta-connection.service";
import { ConnectMetaDto } from "./dto/connect-meta.dto";
import { SelectAssetsDto } from "./dto/select-assets.dto";

@ApiTags("Meta")
@Controller("meta")
export class MetaController {
  constructor(private readonly meta: MetaConnectionService) {}

  @Get("requirements")
  requirements() {
    return this.meta.requirements();
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post("connection")
  @HttpCode(HttpStatus.OK)
  connect(@CurrentUser() ctx: TenantContext, @Body() body: ConnectMetaDto) {
    return this.meta.connect(ctx, body.token);
  }

  @Get("connection")
  connection(@CurrentUser() ctx: TenantContext) {
    return this.meta.view(ctx.workspaceId);
  }

  @Delete("connection")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@CurrentUser() ctx: TenantContext): Promise<void> {
    return this.meta.disconnect(ctx);
  }

  @Get("assets")
  assets(@CurrentUser() ctx: TenantContext) {
    return this.meta.listAssets(ctx.workspaceId);
  }

  @Put("assets/selection")
  select(@CurrentUser() ctx: TenantContext, @Body() body: SelectAssetsDto) {
    return this.meta.select(ctx, body);
  }
}
