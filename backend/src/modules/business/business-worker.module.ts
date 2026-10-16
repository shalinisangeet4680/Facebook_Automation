import { Module } from "@nestjs/common";

import { BusinessModule } from "./business.module";
import {
  BusinessProcessor,
  BusinessScheduler,
} from "./infrastructure/business.processor";

@Module({
  imports: [BusinessModule],
  providers: [BusinessProcessor, BusinessScheduler],
})
export class BusinessWorkerModule {}
