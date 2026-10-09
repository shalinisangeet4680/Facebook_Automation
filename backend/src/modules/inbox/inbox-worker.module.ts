import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { InboxService } from "./application/inbox.service";
import {
  InboxProcessor,
  InboxScheduler,
} from "./infrastructure/inbox.processor";

@Module({
  imports: [AdsModule, MetaModule, SettingsModule],
  providers: [InboxService, InboxProcessor, InboxScheduler],
})
export class InboxWorkerModule {}
