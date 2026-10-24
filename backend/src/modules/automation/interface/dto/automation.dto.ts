import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { AI_MODES } from "@modules/engine/domain/engine.types";

export class AgentPermissionsInputDto {
  @IsOptional()
  @IsBoolean()
  gbpDrafts?: boolean;

  @IsOptional()
  @IsBoolean()
  gbpPosts?: boolean;

  @IsOptional()
  @IsBoolean()
  gbpInfo?: boolean;

  @IsOptional()
  @IsBoolean()
  gbpReplySettings?: boolean;

  @IsOptional()
  @IsBoolean()
  gbpProfiles?: boolean;
}

export class AgentPermissionsDto {
  gbpDrafts: boolean;
  gbpPosts: boolean;
  gbpInfo: boolean;
  gbpReplySettings: boolean;
  gbpProfiles: boolean;
}

export class UpdateAutomationSettingsDto {
  @IsOptional()
  @IsIn(AI_MODES)
  @ApiProperty({ enum: AI_MODES, required: false })
  aiMode?: (typeof AI_MODES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  aiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  slackWebhook?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(81)
  slackChannel?: string | null;

  @IsOptional()
  @IsBoolean()
  agentsCanPost?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentPermissionsInputDto)
  agentPermissions?: AgentPermissionsInputDto;

  @IsOptional()
  @IsBoolean()
  notifyNewLeads?: boolean;
}

export class AutomationSettingsDto {
  @ApiProperty({ enum: AI_MODES })
  aiMode: (typeof AI_MODES)[number];
  platformAi: boolean;
  aiKeyHint: string | null;
  aiReady: boolean;
  model: string;
  dailyDrafts: number;
  draftsToday: number;
  slackConnected: boolean;
  slackChannel: string | null;
  agentsCanPost: boolean;
  agentPermissions: AgentPermissionsDto;
  notifyNewLeads: boolean;
}
