import { Module } from "@nestjs/common";

import { CreativesModule } from "@modules/creatives/creatives.module";

import { StoreService } from "./application/store.service";
import { StoreRepository } from "./infrastructure/store.repository";
import { StoreUploadController } from "./interface/store-upload.controller";
import { StoreController } from "./interface/store.controller";

@Module({
  imports: [CreativesModule],
  controllers: [StoreController, StoreUploadController],
  providers: [StoreService, StoreRepository],
  exports: [StoreService],
})
export class StoreModule {}
