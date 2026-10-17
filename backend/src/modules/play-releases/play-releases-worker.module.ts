import { Module } from "@nestjs/common";

import {
  PlayReleasesProcessor,
  PlayReleasesScheduler,
} from "./infrastructure/play-releases.processor";
import { PlayReleasesModule } from "./play-releases.module";

@Module({
  imports: [PlayReleasesModule],
  providers: [PlayReleasesProcessor, PlayReleasesScheduler],
})
export class PlayReleasesWorkerModule {}
