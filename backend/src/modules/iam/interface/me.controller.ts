import { Controller, Get } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { IdentityService } from "../application/identity.service";
import { MeResponseDto } from "./dto/me-response.dto";

@ApiTags("Me")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("me")
export class MeController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  me(@CurrentUser() ctx: TenantContext): Promise<MeResponseDto> {
    return this.identity.me(ctx);
  }
}
