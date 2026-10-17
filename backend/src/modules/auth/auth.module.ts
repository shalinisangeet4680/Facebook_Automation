import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { IamModule } from "@modules/iam/iam.module";
import { Env } from "@shared/config/env.validation";

import { AuthService } from "./application/auth.service";
import { OtpService } from "./application/otp.service";
import { SessionService } from "./application/session.service";
import { GOOGLE_IDENTITY } from "./domain/ports/google-identity";
import { OTP_SENDER } from "./domain/ports/otp-sender";
import {
  GoogleIdentityClient,
  MockGoogleIdentity,
} from "./infrastructure/google-identity.client";
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
    {
      provide: GOOGLE_IDENTITY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("AUTH_GOOGLE_MOCK", { infer: true })
          ? new MockGoogleIdentity(
              config.get("AUTH_GOOGLE_MOCK_EMAIL", { infer: true }),
            )
          : new GoogleIdentityClient(
              config.get("GOOGLE_CLIENT_ID", { infer: true }) ?? "",
              config.get("GOOGLE_CLIENT_SECRET", { infer: true }) ?? "",
            ),
    },
  ],
  exports: [OtpChallengeRepository, RefreshTokenRepository],
})
export class AuthModule {}
