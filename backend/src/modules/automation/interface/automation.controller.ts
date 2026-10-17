import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { AutomationSettingsService } from "../application/automation-settings.service";
import {
  AutomationSettingsDto,
  UpdateAutomationSettingsDto,
} from "./dto/automation.dto";

@ApiTags("Automation")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("automation")
export class AutomationController {
  constructor(private readonly automation: AutomationSettingsService) {}

  @Get("settings")
  get(@CurrentUser() ctx: TenantContext): Promise<AutomationSettingsDto> {
    return this.automation.get(ctx.workspaceId);
  }

  @Put("settings")
  update(
    @CurrentUser() ctx: TenantContext,
    @Body() body: UpdateAutomationSettingsDto,
  ): Promise<AutomationSettingsDto> {
    return this.automation.update(
      { userId: ctx.userId, workspaceId: ctx.workspaceId, via: "app" },
      body,
    );
  }
}
