import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { AppConfig } from "@shared/config/app-config";

import { CryptoService } from "./crypto.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";
import { ACCESS_TOKEN_TTL_SECONDS, TokenService } from "./token.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfig) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: {
          algorithm: "HS256",
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
        verifyOptions: { algorithms: ["HS256"] },
      }),
    }),
  ],
  providers: [CryptoService, RedisThrottlerStorage, TokenService],
  exports: [CryptoService, RedisThrottlerStorage, TokenService],
})
export class SecurityModule {}
