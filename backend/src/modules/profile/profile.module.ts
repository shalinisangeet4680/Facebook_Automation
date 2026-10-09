import { Module } from "@nestjs/common";

import { CreativesModule } from "@modules/creatives/creatives.module";
import { MetaModule } from "@modules/meta/meta.module";

import { ProfileService } from "./application/profile.service";
import { ProfileController } from "./interface/profile.controller";

@Module({
  imports: [MetaModule, CreativesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
