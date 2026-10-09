import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

import { JOBS } from "@shared/queue/job-names";
import { QUEUES } from "@shared/queue/queue.constants";

import { SocialService } from "../application/social.service";

interface PublishJob {
  workspaceId: string;
  postId: string;
}

@Processor(QUEUES.SOCIAL, { concurrency: 3 })
export class SocialPublishProcessor extends WorkerHost {
  constructor(private readonly social: SocialService) {
    super();
  }

  async process(job: Job<PublishJob>): Promise<unknown> {
    if (job.name !== JOBS.PUBLISH_POST) return null;
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const row = await this.social.publish(job.data.postId, finalAttempt);
    return row ? { status: row.status } : { skipped: true };
  }
}
