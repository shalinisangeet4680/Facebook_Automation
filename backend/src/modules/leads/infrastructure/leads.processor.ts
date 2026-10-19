import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Job } from "bullmq";

import { JOBS, WorkspaceJobData } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { LeadSyncService } from "../application/lead-sync.service";
import { LeadScheduler } from "./lead-scheduler";

@Processor(QUEUES.LEADS, { concurrency: 3 })
export class LeadsProcessor extends WorkerHost {
  constructor(private readonly sync: LeadSyncService) {
    super();
  }

  async process(job: Job<WorkspaceJobData>): Promise<unknown> {
    if (job.name === JOBS.LEADS_SYNC) {
      const result = await this.sync.sync(job.data.workspaceId);
      return {
        status: result.status,
        created: result.created,
        alerted: result.alerted,
        errorCode: result.errorCode,
      };
    }
    if (job.name === JOBS.LEADS_RECONCILE) return this.sync.reconcile();
    return null;
  }
}

@Injectable()
export class LeadsBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(LeadsBootstrap.name);

  constructor(
    private readonly scheduler: LeadScheduler,
    private readonly sync: LeadSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.scheduler.scheduleReconcile();
    void this.sync.reconcile().catch((err: unknown) => {
      this.logger.warn(
        `Lead schedule reconcile failed: ${(err as Error).message}`,
      );
    });
  }
}
