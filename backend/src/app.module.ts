import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";

import { HealthModule } from "@modules/health/health.module";
import { ConfigModule } from "@shared/config/config.module";
import { DatabaseModule } from "@shared/database/database.module";
import { AllExceptionsFilter } from "@shared/errors/all-exceptions.filter";
import { LoggingModule } from "@shared/logging/logging.module";
import { SecurityModule } from "@shared/security/security.module";

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    DatabaseModule,
    SecurityModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
