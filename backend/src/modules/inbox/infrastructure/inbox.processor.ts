import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { eq } from "drizzle-orm";

import { metaConnections } from "@modules/meta/infrastructure/meta.tables";
import { DATABASE, Database } from "@shared/database/database";
import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { InboxService } from "../application/inbox.service";

@Processor(QUEUES.AUTOPILOT, { concurrency: 1 })
export class InboxProcessor extends WorkerHost {
  private readonly logger = new Logger(InboxProcessor.name);

  constructor(
    private readonly inbox: InboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== JOBS.RUN_RULES_ALL) return null;
    const rows = await this.db
      .select({ workspaceId: metaConnections.workspaceId })
      .from(metaConnections)
      .where(eq(metaConnections.status, "active"));
    let created = 0;
    let failed = 0;
    for (const { workspaceId } of rows) {
      try {
        created += (await this.inbox.refresh(workspaceId)).created;
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Rules failed for ${workspaceId}: ${(err as Error).message}`,
        );
      }
    }
    return { workspaces: rows.length, created, failed };
  }
}

@Injectable()
export class InboxScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.AUTOPILOT) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOBS.RUN_RULES_ALL,
      { pattern: "30 7 * * *", tz: "Asia/Kolkata" },
      { name: JOBS.RUN_RULES_ALL },
    );
  }
}
