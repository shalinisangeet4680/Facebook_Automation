import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { SettingsService } from "../application/settings.service";
import {
  SettingsResponseDto,
  UpdateBusinessBasicsDto,
  UpdateGoalBudgetDto,
  UpdateProfileDto,
  UpdateWorkspaceDto,
} from "./dto/settings.dto";

@ApiTags("Settings")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() ctx: TenantContext): Promise<SettingsResponseDto> {
    return this.settings.get(ctx);
  }

  @Put("workspace")
  workspace(
    @CurrentUser() ctx: TenantContext,
    @Body() body: UpdateWorkspaceDto,
  ): Promise<SettingsResponseDto> {
    return this.settings.updateWorkspace(ctx, body);
  }

  @Put("business")
  business(
    @CurrentUser() ctx: TenantContext,
    @Body() body: UpdateBusinessBasicsDto,
  ): Promise<SettingsResponseDto> {
    return this.settings.updateBasics(ctx, body);
  }

  @Put("goal")
  goal(
    @CurrentUser() ctx: TenantContext,
    @Body() body: UpdateGoalBudgetDto,
  ): Promise<SettingsResponseDto> {
    return this.settings.updateGoalBudget(ctx, body);
  }

  @Put("profile")
  profile(
    @CurrentUser() ctx: TenantContext,
    @Body() body: UpdateProfileDto,
  ): Promise<SettingsResponseDto> {
    return this.settings.updateProfile(ctx, {
      name: body.name,
      email: body.email ?? null,
    });
  }
}
