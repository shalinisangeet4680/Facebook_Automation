import { Module } from "@nestjs/common";

import {
  LeadsBootstrap,
  LeadsProcessor,
} from "./infrastructure/leads.processor";
import { LeadsModule } from "./leads.module";

@Module({
  imports: [LeadsModule],
  providers: [LeadsProcessor, LeadsBootstrap],
})
export class LeadsWorkerModule {}
