import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { InboxService } from "./application/inbox.service";
import { InboxController } from "./interface/inbox.controller";

@Module({
  imports: [AdsModule, MetaModule, SettingsModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
