import { Module } from "@nestjs/common";

import { PlayProcessor, PlayScheduler } from "./infrastructure/play.processor";
import { PlayModule } from "./play.module";

@Module({
  imports: [PlayModule],
  providers: [PlayProcessor, PlayScheduler],
})
export class PlayWorkerModule {}
