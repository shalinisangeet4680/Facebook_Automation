import { Global, Module } from "@nestjs/common";

import { CryptoService } from "./crypto.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
  providers: [CryptoService, RedisThrottlerStorage],
  exports: [CryptoService, RedisThrottlerStorage],
})
export class SecurityModule {}
