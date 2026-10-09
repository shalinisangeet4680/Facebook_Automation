import {
  UserProfileDto,
  WorkspaceSummaryDto,
} from "@modules/iam/interface/dto/me-response.dto";

export class OtpRequestedDto {
  phone: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}

export class TokensResponseDto {
  accessTokenExpiresIn: number;
  accessToken?: string;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
}

export class SignInResponseDto extends TokensResponseDto {
  user: UserProfileDto;
  workspace: WorkspaceSummaryDto;
  isNewUser: boolean;
}
