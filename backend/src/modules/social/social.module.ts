import { Module } from "@nestjs/common";

import { CreativesModule } from "@modules/creatives/creatives.module";
import { MetaModule } from "@modules/meta/meta.module";

import { SocialService } from "./application/social.service";
import { SocialController } from "./interface/social.controller";

@Module({
  imports: [MetaModule, CreativesModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
