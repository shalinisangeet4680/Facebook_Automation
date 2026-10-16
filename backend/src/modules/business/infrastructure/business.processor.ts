import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { BusinessEngine } from "../application/business-engine.service";
import { BusinessService } from "../application/business.service";

const SYNC_EVERY_MS = 30 * 60_000;
const DAY = 86_400_000;

@Processor(QUEUES.BUSINESS, { concurrency: 1 })
export class BusinessProcessor extends WorkerHost {
  private readonly logger = new Logger(BusinessProcessor.name);

  constructor(
    private readonly engine: BusinessEngine,
    private readonly business: BusinessService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== JOBS.BUSINESS_TICK) return null;
    const replies = await this.engine.sendDue();
    const posts = await this.engine.publishDue();
    let synced = 0;
    let failed = 0;
    for (const location of await this.engine.repo.locationsDueForSync(
      new Date(Date.now() - SYNC_EVERY_MS),
      20,
    )) {
      try {
        await this.engine.sync(location);
        synced++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `Sync failed for ${location.title}: ${(err as Error).message}`,
        );
      }
    }
    let metrics = 0;
    for (const location of await this.engine.repo.locationsDueForMetrics(
      new Date(Date.now() - DAY),
      10,
    )) {
      try {
        await this.engine.syncMetrics(location);
        metrics++;
      } catch (err) {
        this.logger.warn(
          `Insights failed for ${location.title}: ${(err as Error).message}`,
        );
      }
    }
    let discovered = 0;
    for (const c of await this.engine.repo.connectionsDueForDiscovery(
      new Date(Date.now() - DAY),
      5,
    )) {
      try {
        const result = await this.business.discover(
          { userId: null, workspaceId: c.workspaceId, via: "automation" },
          c.id,
        );
        discovered += result.added.length + result.restored.length;
      } catch (err) {
        this.logger.warn(
          `Location discovery failed for ${c.email}: ${(err as Error).message}`,
        );
      }
    }
    return { replies, posts, synced, failed, metrics, discovered };
  }
}

@Injectable()
export class BusinessScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.BUSINESS) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.BUSINESS_TICK,
      { every: 5 * 60_000 },
      { name: JOBS.BUSINESS_TICK, opts: { attempts: 1 } },
    );
  }
}
