import { Module } from "@nestjs/common";

import { CreativesService } from "./application/creatives.service";
import { MEDIA_STORAGE } from "./domain/ports/media-storage";
import { LocalMediaStorage } from "./infrastructure/local-media.storage";
import { CreativesController } from "./interface/creatives.controller";
import { MediaController } from "./interface/media.controller";

@Module({
  controllers: [CreativesController, MediaController],
  providers: [
    CreativesService,
    { provide: MEDIA_STORAGE, useClass: LocalMediaStorage },
  ],
  exports: [CreativesService, MEDIA_STORAGE],
})
export class CreativesModule {}
