import { ApiProperty } from "@nestjs/swagger";

import {
  VERIFICATION_METHODS,
  VERIFICATION_STATES,
} from "../../domain/profile.types";

export class GbpAccountDto {
  connectionId: string;
  email: string;
  account: string;
  name: string;
  type: string;
}

export class GbpAccountListDto {
  data: GbpAccountDto[];
}

export class GbpCategoryDto {
  name: string;
  displayName: string;
}

export class GbpCategoryListDto {
  data: GbpCategoryDto[];
}

export class GoogleMatchDto {
  name: string;
  title: string;
  address: string | null;
  phone: string | null;
  category: string | null;
  placeId: string | null;
  mapsUri: string | null;
  requestAdminRightsUri: string | null;
  locationId: string | null;
}

export class GoogleMatchListDto {
  data: GoogleMatchDto[];
}

export class ProfileValidationDto {
  valid: boolean;
  problems: string[];
  summary: string[];
}

export class VerificationOptionDto {
  @ApiProperty({ enum: VERIFICATION_METHODS })
  method: (typeof VERIFICATION_METHODS)[number];
  label: string;
  needsCode: boolean;
  phone: string | null;
  email: string | null;
  emailEditable: boolean;
  address: string | null;
  contactName: string | null;
  deliveryDays: number | null;
}

export class VerificationOptionListDto {
  data: VerificationOptionDto[];
  manageUrl: string;
}

export class VerificationStatusDto {
  locationId: string;
  title: string;
  verified: boolean;
  @ApiProperty({ enum: VERIFICATION_STATES })
  state: (typeof VERIFICATION_STATES)[number];
  @ApiProperty({ enum: VERIFICATION_METHODS, nullable: true })
  method: (typeof VERIFICATION_METHODS)[number] | null;
  methodLabel: string | null;
  target: string | null;
  startedAt: string | null;
  needsCode: boolean;
  waitingForGoogle: boolean;
  ownershipConflict: boolean;
  guidelinesIssue: string | null;
  note: string;
  error: string | null;
  manageUrl: string;
}
