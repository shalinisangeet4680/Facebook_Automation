import { Module } from "@nestjs/common";

import { CreativesModule } from "@modules/creatives/creatives.module";
import { MetaModule } from "@modules/meta/meta.module";

import { SocialService } from "./application/social.service";
import { SocialPublishProcessor } from "./infrastructure/social-publish.processor";

@Module({
  imports: [MetaModule, CreativesModule],
  providers: [SocialService, SocialPublishProcessor],
})
export class SocialWorkerModule {}
