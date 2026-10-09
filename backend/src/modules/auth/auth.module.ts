import { Module } from "@nestjs/common";

import { IamModule } from "@modules/iam/iam.module";

import { AuthService } from "./application/auth.service";
import { OtpService } from "./application/otp.service";
import { SessionService } from "./application/session.service";
import { OTP_SENDER } from "./domain/ports/otp-sender";
import { LogOtpSender } from "./infrastructure/log-otp.sender";
import { OtpChallengeRepository } from "./infrastructure/otp-challenge.repository";
import { RefreshTokenRepository } from "./infrastructure/refresh-token.repository";
import { AuthController } from "./interface/auth.controller";

@Module({
  imports: [IamModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    OtpChallengeRepository,
    RefreshTokenRepository,
    { provide: OTP_SENDER, useClass: LogOtpSender },
  ],
  exports: [OtpChallengeRepository, RefreshTokenRepository],
})
export class AuthModule {}
