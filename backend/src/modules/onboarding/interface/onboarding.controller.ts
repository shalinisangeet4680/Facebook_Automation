import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { OnboardingService } from "../application/onboarding.service";
import { OnboardingView } from "../domain/onboarding.steps";

@ApiTags("Onboarding")
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  view(@CurrentUser() ctx: TenantContext): Promise<OnboardingView> {
    return this.onboarding.view(ctx.workspaceId);
  }
}
