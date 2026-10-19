import { Module } from "@nestjs/common";

import { CreativesModule } from "@modules/creatives/creatives.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { AdsService } from "./application/ads.service";
import { CampaignManagerService } from "./application/campaign-manager.service";
import { ConfirmationService } from "./application/confirmation.service";
import { AdsController } from "./interface/ads.controller";
import { CampaignsController } from "./interface/campaigns.controller";

@Module({
  imports: [MetaModule, SettingsModule, CreativesModule],
  controllers: [AdsController, CampaignsController],
  providers: [AdsService, CampaignManagerService, ConfirmationService],
  exports: [AdsService, ConfirmationService],
})
export class AdsModule {}
