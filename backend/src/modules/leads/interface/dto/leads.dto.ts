import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

import { LEAD_STATUSES } from "../../infrastructure/leads.tables";

type Status = "new" | "contacted" | "won" | "lost";

export class LeadFiltersQueryDto {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: Status;

  @IsOptional()
  @Matches(/^\d{1,30}$/, { message: "campaignId must be a Meta campaign id" })
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class LeadListQueryDto extends LeadFiltersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: Status;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class LeadAnswerDto {
  key: string;
  label: string;
  value: string;
}

export class LeadRefDto {
  id: string;
  name: string | null;
}

export class LeadFormRefDto {
  id: string;
  name: string | null;
}

export class LeadDto {
  id: string;
  leadId: string;
  createdTime: string;
  @ApiProperty({ enum: LEAD_STATUSES })
  status: Status;
  notes: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  answers: LeadAnswerDto[];
  form: LeadFormRefDto;
  campaign: LeadRefDto | null;
  adSet: LeadRefDto | null;
  ad: LeadRefDto | null;
}

export class LeadListDto {
  data: LeadDto[];
  nextCursor: string | null;
}

export class LeadSyncStateDto {
  @ApiProperty({ enum: ["never", "ok", "error"] })
  status: "never" | "ok" | "error";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  @ApiProperty({
    enum: ["permission_missing", "not_connected", "no_page", "failed"],
    nullable: true,
  })
  errorCode:
    "permission_missing" | "not_connected" | "no_page" | "failed" | null;
  error: string | null;
  fixes: string[];
  permissionGranted: boolean;
  forms: number;
}

export class LeadSummaryDto {
  total: number;
  new: number;
  today: number;
  campaigns: LeadRefDto[];
  sync: LeadSyncStateDto;
}

export class LeadSyncResultDto {
  @ApiProperty({ enum: ["ok", "error"] })
  status: "ok" | "error";
  forms: number;
  fetched: number;
  created: number;
  alerted: number;
  @ApiProperty({
    enum: ["permission_missing", "not_connected", "no_page", "failed"],
    nullable: true,
  })
  errorCode:
    "permission_missing" | "not_connected" | "no_page" | "failed" | null;
  error: string | null;
}
