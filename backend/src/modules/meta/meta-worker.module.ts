import { Module } from "@nestjs/common";

import { MetaSyncProcessor } from "./infrastructure/meta-sync.processor";
import { MetaModule } from "./meta.module";

@Module({
  imports: [MetaModule],
  providers: [MetaSyncProcessor],
})
export class MetaWorkerModule {}
