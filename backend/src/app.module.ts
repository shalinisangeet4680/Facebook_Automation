import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule } from "@nestjs/throttler";

import { AuditModule } from "@modules/audit/audit.module";
import { AutomationModule } from "@modules/automation/automation.module";
import { AuthModule } from "@modules/auth/auth.module";
import { HealthModule } from "@modules/health/health.module";
import { IamModule } from "@modules/iam/iam.module";
import { JobsModule } from "@modules/jobs/jobs.module";
import { CreativesModule } from "@modules/creatives/creatives.module";
import { InboxModule } from "@modules/inbox/inbox.module";
import { LeadsModule } from "@modules/leads/leads.module";
import { McpModule } from "@modules/mcp/mcp.module";
import { ProfileModule } from "@modules/profile/profile.module";
import { MetaLoginModule } from "@modules/meta/meta-login.module";
import { MetaModule } from "@modules/meta/meta.module";
import { OAuthModule } from "@modules/oauth/oauth.module";
import { PlansModule } from "@modules/plans/plans.module";
import { ReportsModule } from "@modules/reports/reports.module";
import { SettingsModule } from "@modules/settings/settings.module";
import { SocialModule } from "@modules/social/social.module";
import { PlayModule } from "@modules/play/play.module";
import { PlayReleasesModule } from "@modules/play-releases/play-releases.module";
import { BusinessModule } from "@modules/business/business.module";
import { SocialEngineModule } from "@modules/social-engine/social-engine.module";
import { StoreModule } from "@modules/store/store.module";
import { OnboardingModule } from "@modules/onboarding/onboarding.module";
import { CacheModule } from "@shared/cache/cache.module";
import { ConfigModule } from "@shared/config/config.module";
import { DatabaseModule } from "@shared/database/database.module";
import { AllExceptionsFilter } from "@shared/errors/all-exceptions.filter";
import { IdempotencyModule } from "@shared/idempotency/idempotency.module";
import { LoggingModule } from "@shared/logging/logging.module";
import { QueueModule } from "@shared/queue/queue.module";
import { AppThrottlerGuard } from "@shared/security/app-throttler.guard";
import { AuthGuard } from "@shared/security/auth.guard";
import { ClientGuard } from "@shared/security/client.guard";
import { RedisThrottlerStorage } from "@shared/security/redis-throttler.storage";
import { SecurityModule } from "@shared/security/security.module";

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    LoggingModule.forRoot("api"),
    DatabaseModule,
    CacheModule,
    QueueModule,
    SecurityModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ name: "default", ttl: 60_000, limit: 300 }],
        storage,
      }),
    }),
    IdempotencyModule,
    AuditModule,
    JobsModule,
    HealthModule,
    IamModule,
    AuthModule,
    MetaModule,
    OnboardingModule,
    MetaLoginModule,
    OAuthModule,
    SettingsModule,
    ReportsModule,
    CreativesModule,
    SocialModule,
    InboxModule,
    ProfileModule,
    PlansModule,
    LeadsModule,
    StoreModule,
    PlayModule,
    PlayReleasesModule,
    BusinessModule,
    AutomationModule,
    SocialEngineModule,
    McpModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ClientGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
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
