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
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { JobsService } from "@modules/jobs/application/jobs.service";
import { JobAcceptedDto } from "@modules/jobs/interface/dto/job-response.dto";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { MetaConnectionService } from "../application/meta-connection.service";
import { ConnectMetaDto } from "./dto/connect-meta.dto";
import {
  AdAccountSwitchDto,
  AssetListResponseDto,
  ConnectionResponseDto,
  RequirementsResponseDto,
} from "./dto/meta-response.dto";
import { SelectAssetsDto, SwitchAdAccountDto } from "./dto/select-assets.dto";

@ApiTags("Meta")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("meta")
export class MetaController {
  constructor(
    private readonly meta: MetaConnectionService,
    private readonly jobs: JobsService,
  ) {}

  @Get("requirements")
  requirements(): RequirementsResponseDto {
    return this.meta.requirements();
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post("connection")
  @HttpCode(HttpStatus.OK)
  connect(
    @CurrentUser() ctx: TenantContext,
    @Body() body: ConnectMetaDto,
  ): Promise<ConnectionResponseDto> {
    return this.meta.connect(ctx, body.token);
  }

  @Get("connection")
  connection(
    @CurrentUser() ctx: TenantContext,
  ): Promise<ConnectionResponseDto> {
    return this.meta.view(ctx.workspaceId);
  }

  @Delete("connection")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@CurrentUser() ctx: TenantContext): Promise<void> {
    return this.meta.disconnect(ctx);
  }

  @Get("assets")
  assets(@CurrentUser() ctx: TenantContext): Promise<AssetListResponseDto> {
    return this.meta.listAssets(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 12, ttl: 3_600_000 } })
  @Post("assets/refresh")
  @HttpCode(HttpStatus.ACCEPTED)
  async refreshAssets(
    @CurrentUser() ctx: TenantContext,
  ): Promise<JobAcceptedDto> {
    await this.meta.accessToken(ctx.workspaceId);
    return this.jobs.enqueue(
      QUEUES.META_SYNC,
      JOBS.REFRESH_ASSETS,
      { workspaceId: ctx.workspaceId, requestedBy: ctx.userId },
      Math.floor(Date.now() / 60_000).toString(),
    );
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Put("assets/ad-account")
  switchAdAccount(
    @CurrentUser() ctx: TenantContext,
    @Body() body: SwitchAdAccountDto,
  ): Promise<AdAccountSwitchDto> {
    return this.meta.switchAdAccount(ctx, body.adAccountId);
  }

  @Put("assets/selection")
  select(
    @CurrentUser() ctx: TenantContext,
    @Body() body: SelectAssetsDto,
  ): Promise<ConnectionResponseDto> {
    return this.meta.select(ctx, body);
  }
}
