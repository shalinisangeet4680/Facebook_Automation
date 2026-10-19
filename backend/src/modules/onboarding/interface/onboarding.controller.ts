import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { OnboardingService } from "../application/onboarding.service";
import { OnboardingResponseDto } from "./dto/onboarding-response.dto";

@ApiTags("Onboarding")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  view(@CurrentUser() ctx: TenantContext): Promise<OnboardingResponseDto> {
    return this.onboarding.view(ctx.workspaceId);
  }

  @Post("steps/:step/skip")
  @HttpCode(HttpStatus.OK)
  skip(
    @CurrentUser() ctx: TenantContext,
    @Param("step") step: string,
  ): Promise<OnboardingResponseDto> {
    return this.onboarding.skip(ctx.workspaceId, step);
  }
}
