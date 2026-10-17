import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { SocialCommentsService } from "../application/social-comments.service";
import { SocialContentService } from "../application/social-content.service";
import { SocialEngine } from "../application/social-engine.service";
import { SocialInsightsService } from "../application/social-insights.service";

const COMMENTS_EVERY_MS = 15 * 60_000;
const DAY = 86_400_000;

@Processor(QUEUES.AUTOPOST, { concurrency: 1 })
export class SocialEngineProcessor extends WorkerHost {
  private readonly logger = new Logger(SocialEngineProcessor.name);

  constructor(
    private readonly engine: SocialEngine,
    private readonly comments: SocialCommentsService,
    private readonly insights: SocialInsightsService,
    private readonly content: SocialContentService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== JOBS.AUTOPOST_TICK) return null;
    const posts = await this.engine.publishDue();
    const replies = await this.comments.sendDue();
    let synced = 0;
    for (const account of await this.engine.repo.accountsDue(
      "commentsSyncedAt",
      new Date(Date.now() - COMMENTS_EVERY_MS),
      20,
    )) {
      try {
        await this.comments.sync(account);
        synced++;
      } catch (err) {
        this.logger.warn(
          `Comment sync failed for ${account.name}: ${(err as Error).message}`,
        );
      }
    }
    let metrics = 0;
    for (const account of await this.engine.repo.accountsDue(
      "metricsSyncedAt",
      new Date(Date.now() - DAY),
      10,
    )) {
      try {
        await this.insights.syncMetrics(account);
        metrics++;
      } catch (err) {
        this.logger.warn(
          `Insights failed for ${account.name}: ${(err as Error).message}`,
        );
      }
    }
    const plans = await this.content.weeklyPlans();
    const refreshed = await this.engine.refreshTokens();
    let digests = 0;
    for (const account of await this.engine.repo.activeAccounts(500)) {
      if (!this.insights.isDigestDay(account)) continue;
      try {
        if (
          await this.insights.digest(account, {
            userId: null,
            workspaceId: account.workspaceId,
            via: "automation",
          })
        )
          digests++;
      } catch (err) {
        this.logger.warn(`Digest failed: ${(err as Error).message}`);
      }
    }
    return { posts, replies, synced, metrics, plans, refreshed, digests };
  }
}

@Injectable()
export class SocialEngineScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.AUTOPOST) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.AUTOPOST_TICK,
      { every: 60_000 },
      { name: JOBS.AUTOPOST_TICK, opts: { attempts: 1 } },
    );
  }
}
