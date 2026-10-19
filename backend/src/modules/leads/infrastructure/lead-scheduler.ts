import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import {
  RECONCILE_EVERY_MS,
  SCHEDULER_PREFIX,
  schedulerId,
  SYNC_EVERY_MS,
} from "../domain/lead-sync";

@Injectable()
export class LeadScheduler {
  constructor(@InjectQueue(QUEUES.LEADS) private readonly queue: Queue) {}

  async ensure(workspaceId: string): Promise<void> {
    await this.queue.upsertJobScheduler(
      schedulerId(workspaceId),
      { every: SYNC_EVERY_MS },
      {
        name: JOBS.LEADS_SYNC,
        data: { workspaceId },
        opts: { attempts: 1 },
      },
    );
  }

  async remove(workspaceId: string): Promise<void> {
    await this.queue.removeJobScheduler(schedulerId(workspaceId));
  }

  async scheduled(): Promise<string[]> {
    const schedulers = await this.queue.getJobSchedulers(0, -1);
    return schedulers
      .map((s) => s.key)
      .filter((key) => key.startsWith(SCHEDULER_PREFIX))
      .map((key) => key.slice(SCHEDULER_PREFIX.length));
  }

  async isScheduled(workspaceId: string): Promise<boolean> {
    return Boolean(await this.queue.getJobScheduler(schedulerId(workspaceId)));
  }

  async scheduleReconcile(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.LEADS_RECONCILE,
      { every: RECONCILE_EVERY_MS },
      { name: JOBS.LEADS_RECONCILE, opts: { attempts: 1 } },
    );
  }
}
