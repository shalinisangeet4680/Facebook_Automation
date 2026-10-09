import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

import { JOBS, WorkspaceJobData } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { MetaConnectionService } from "../application/meta-connection.service";

@Processor(QUEUES.META_SYNC, { concurrency: 5 })
export class MetaSyncProcessor extends WorkerHost {
  constructor(private readonly meta: MetaConnectionService) {
    super();
  }

  async process(job: Job<WorkspaceJobData>): Promise<unknown> {
    if (job.name === JOBS.REFRESH_ASSETS) {
      await job.updateProgress(10);
      const assets = await this.meta.refreshAssets(job.data.workspaceId);
      await job.updateProgress(100);
      return { assets };
    }
    return null;
  }
}
