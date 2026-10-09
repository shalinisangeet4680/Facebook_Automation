import { Module } from "@nestjs/common";

import { MetaModule } from "@modules/meta/meta.module";

import { AdsService } from "./application/ads.service";
import { ConfirmationService } from "./application/confirmation.service";

@Module({
  imports: [MetaModule],
  providers: [AdsService, ConfirmationService],
  exports: [AdsService],
})
export class AdsModule {}
