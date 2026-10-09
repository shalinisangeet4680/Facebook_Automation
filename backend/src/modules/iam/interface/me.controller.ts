import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { IdentityService } from "../application/identity.service";
import { MeView } from "../domain/identity.types";

@ApiTags("Me")
@Controller("me")
export class MeController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  me(@CurrentUser() ctx: TenantContext): Promise<MeView> {
    return this.identity.me(ctx);
  }
}
