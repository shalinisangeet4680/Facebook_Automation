import { Module } from "@nestjs/common";

import { AdsModule } from "@modules/ads/ads.module";
import { MetaModule } from "@modules/meta/meta.module";
import { SettingsModule } from "@modules/settings/settings.module";

import { ReportsService } from "./application/reports.service";
import { ReportsController } from "./interface/reports.controller";

@Module({
  imports: [AdsModule, MetaModule, SettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
