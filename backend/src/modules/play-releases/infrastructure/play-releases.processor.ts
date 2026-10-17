import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { RolloutGuardian } from "../application/rollout-guardian.service";

@Processor(QUEUES.PLAY_RELEASES, { concurrency: 1 })
export class PlayReleasesProcessor extends WorkerHost {
  constructor(private readonly guardian: RolloutGuardian) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== JOBS.PLAY_RELEASES_TICK) return null;
    return this.guardian.tick();
  }
}

@Injectable()
export class PlayReleasesScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(QUEUES.PLAY_RELEASES) private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.PLAY_RELEASES_TICK,
      { every: 10 * 60_000 },
      { name: JOBS.PLAY_RELEASES_TICK, opts: { attempts: 1 } },
    );
  }
}
