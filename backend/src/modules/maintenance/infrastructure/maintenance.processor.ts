import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { MaintenanceService } from "../application/maintenance.service";

@Processor(QUEUES.MAINTENANCE, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const started = Date.now();
    const result =
      job.name === JOBS.TOKEN_HEALTH
        ? await this.maintenance.checkTokens()
        : job.name === JOBS.CLEANUP
          ? await this.maintenance.cleanup()
          : null;
    this.logger.log(
      `${job.name} done in ${Date.now() - started}ms ${JSON.stringify(result)}`,
    );
    return result;
  }
}
