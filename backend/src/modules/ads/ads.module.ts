import { Module } from "@nestjs/common";

import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { AdsService } from "./application/ads.service";
import { ConfirmationService } from "./application/confirmation.service";
import { AdsController } from "./interface/ads.controller";

@Module({
  imports: [MetaModule, SettingsModule],
  controllers: [AdsController],
  providers: [AdsService, ConfirmationService],
  exports: [AdsService],
})
export class AdsModule {}
