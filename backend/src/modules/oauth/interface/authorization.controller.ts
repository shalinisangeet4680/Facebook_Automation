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
  Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { AppConfig, mcpResourceUrl } from "@shared/config/app-config";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AuthorizationService } from "../application/authorization.service";
import { GrantService } from "../application/grant.service";
import {
  AuthorizationDecisionDto,
  AuthorizationQueryDto,
} from "./dto/authorization-request.dto";
import {
  AuthorizationContextDto,
  AuthorizationRedirectDto,
  ConnectedAppListDto,
  ConnectorInfoDto,
} from "./dto/oauth-response.dto";

@ApiTags("Claude connector")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller()
export class AuthorizationController {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly grants: GrantService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  @Get("oauth/authorization")
  context(
    @CurrentUser() ctx: TenantContext,
    @Query() query: AuthorizationQueryDto,
  ): Promise<AuthorizationContextDto> {
    return this.authorization.context(ctx, query);
  }

  @Post("oauth/authorization")
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentUser() ctx: TenantContext,
    @Body() body: AuthorizationDecisionDto,
  ): Promise<AuthorizationRedirectDto> {
    const { approve, allowWrite, ...params } = body;
    return this.authorization.decide(ctx, params, {
      approve,
      allowWrite: allowWrite ?? false,
    });
  }

  @Get("connector")
  connector(): ConnectorInfoDto {
    return {
      mcpUrl: mcpResourceUrl(this.config),
      maxDailyBudget: this.config.get("ADS_MAX_DAILY_BUDGET", { infer: true }),
    };
  }

  @Get("connected-apps")
  list(@CurrentUser() ctx: TenantContext): Promise<ConnectedAppListDto> {
    return this.grants.list(ctx);
  }

  @Delete("connected-apps/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.grants.disconnect(ctx, id);
  }
}
