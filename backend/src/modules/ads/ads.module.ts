import { Module } from "@nestjs/common";

import { CreativesModule } from "@modules/creatives/creatives.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { AdsService } from "./application/ads.service";
import { AudiencesService } from "./application/audiences.service";
import { CampaignManagerService } from "./application/campaign-manager.service";
import { ConfirmationService } from "./application/confirmation.service";
import { AudienceRepository } from "./infrastructure/audience.repository";
import { AdsController } from "./interface/ads.controller";
import { AudiencesController } from "./interface/audiences.controller";
import { CampaignsController } from "./interface/campaigns.controller";

@Module({
  imports: [MetaModule, SettingsModule, CreativesModule],
  controllers: [AdsController, AudiencesController, CampaignsController],
  providers: [
    AdsService,
    AudiencesService,
    AudienceRepository,
    CampaignManagerService,
    ConfirmationService,
  ],
  exports: [AdsService, AudiencesService, ConfirmationService],
})
export class AdsModule {}
