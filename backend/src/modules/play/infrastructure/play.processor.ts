import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { PlayEngine } from "../application/play-engine.service";
import { PlayService } from "../application/play.service";

const SYNC_EVERY_MS = 15 * 60_000;

@Processor(QUEUES.PLAY, { concurrency: 1 })
export class PlayProcessor extends WorkerHost {
  private readonly logger = new Logger(PlayProcessor.name);

  constructor(
    private readonly engine: PlayEngine,
    private readonly play: PlayService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== JOBS.PLAY_TICK) return null;
    const replies = await this.engine.sendDue();
    const apps = await this.engine.repo.appsDueForSync(
      new Date(Date.now() - SYNC_EVERY_MS),
      20,
    );
    let synced = 0;
    let failed = 0;
    for (const app of apps) {
      try {
        await this.engine.sync(app);
        synced++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `Sync failed for ${app.packageName}: ${(err as Error).message}`,
        );
      }
    }
    let histories = 0;
    for (const app of await this.engine.repo.appsDueForHistory(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() - 3_600_000),
      5,
    )) {
      try {
        await this.play.importHistory(
          { userId: null, workspaceId: app.workspaceId, via: "automation" },
          app.id,
        );
        histories++;
      } catch (err) {
        this.logger.warn(
          `History import failed for ${app.packageName}: ${(err as Error).message}`,
        );
      }
    }
    let discovered = 0;
    for (const c of await this.engine.repo.connectionsDueForDiscovery(
      new Date(Date.now() - 86_400_000),
      5,
    )) {
      try {
        const result = await this.play.discover(
          { userId: null, workspaceId: c.workspaceId, via: "automation" },
          c.id,
        );
        discovered += result.added.length;
      } catch (err) {
        this.logger.warn(
          `App discovery failed for ${c.clientEmail}: ${(err as Error).message}`,
        );
      }
    }
    return { replies, synced, failed, histories, discovered };
  }
}

@Injectable()
export class PlayScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.PLAY) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.PLAY_TICK,
      { every: 5 * 60_000 },
      { name: JOBS.PLAY_TICK, opts: { attempts: 1 } },
    );
  }
}
