import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { Queue } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

const TZ = "Asia/Kolkata";

@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.MAINTENANCE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.TOKEN_HEALTH,
      { pattern: "0 3 * * *", tz: TZ },
      { name: JOBS.TOKEN_HEALTH },
    );
    await this.queue.upsertJobScheduler(
      JOBS.CLEANUP,
      { pattern: "0 4 * * *", tz: TZ },
      { name: JOBS.CLEANUP },
    );
  }
}
