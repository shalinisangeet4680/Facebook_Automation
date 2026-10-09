import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { OAuthModule } from "@modules/oauth/oauth.module";
import { PlansModule } from "@modules/plans/plans.module";

import { McpServerFactory } from "./application/mcp-server.factory";
import { McpAuthGuard } from "./interface/mcp-auth.guard";
import { McpController } from "./interface/mcp.controller";

@Module({
  imports: [AdsModule, OAuthModule, PlansModule],
  controllers: [McpController],
  providers: [McpServerFactory, McpAuthGuard],
})
export class McpModule {}
