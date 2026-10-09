import { Global, Module } from "@nestjs/common";

import { JobsService } from "./application/jobs.service";
import { JobsController } from "./interface/jobs.controller";

@Global()
@Module({
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
