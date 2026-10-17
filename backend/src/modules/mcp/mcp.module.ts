import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { BusinessModule } from "@modules/business/business.module";
import { EngineModule } from "@modules/engine/engine.module";
import { CreativesModule } from "@modules/creatives/creatives.module";
import { InboxModule } from "@modules/inbox/inbox.module";
import { OAuthModule } from "@modules/oauth/oauth.module";
import { PlansModule } from "@modules/plans/plans.module";
import { ProfileModule } from "@modules/profile/profile.module";
import { PlayModule } from "@modules/play/play.module";
import { SocialModule } from "@modules/social/social.module";
import { SocialEngineModule } from "@modules/social-engine/social-engine.module";
import { StoreModule } from "@modules/store/store.module";

import { McpServerFactory } from "./application/mcp-server.factory";
import { McpAuthGuard } from "./interface/mcp-auth.guard";
import { McpController } from "./interface/mcp.controller";

@Module({
  imports: [
    AdsModule,
    OAuthModule,
    PlansModule,
    CreativesModule,
    SocialModule,
    InboxModule,
    ProfileModule,
    StoreModule,
    PlayModule,
    BusinessModule,
    SocialEngineModule,
    EngineModule,
  ],
  controllers: [McpController],
  providers: [McpServerFactory, McpAuthGuard],
})
export class McpModule {}
