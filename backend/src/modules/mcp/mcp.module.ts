import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { CreativesModule } from "@modules/creatives/creatives.module";
import { InboxModule } from "@modules/inbox/inbox.module";
import { OAuthModule } from "@modules/oauth/oauth.module";
import { PlansModule } from "@modules/plans/plans.module";
import { SocialModule } from "@modules/social/social.module";

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
  ],
  controllers: [McpController],
  providers: [McpServerFactory, McpAuthGuard],
})
export class McpModule {}
