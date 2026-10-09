import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { NotFoundError } from "@shared/errors/domain-error";
import { WorkspaceJobData } from "@shared/queue/job-names";
import { QUEUES, QueueName } from "@shared/queue/queue.constants";

import { JobAccepted, JobStatus, JobView } from "../domain/job.types";

const SEPARATOR = "__";

@Injectable()
export class JobsService {
  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectQueue(QUEUES.META_SYNC) metaSync: Queue,
    @InjectQueue(QUEUES.AUTOPILOT) autopilot: Queue,
    @InjectQueue(QUEUES.AI) ai: Queue,
    @InjectQueue(QUEUES.MEDIA) media: Queue,
    @InjectQueue(QUEUES.NOTIFICATIONS) notifications: Queue,
  ) {
    this.queues = new Map(
      [metaSync, autopilot, ai, media, notifications].map((q) => [q.name, q]),
    );
  }

  async enqueue(
    queue: QueueName,
    name: string,
    data: WorkspaceJobData,
    dedupeKey: string,
  ): Promise<JobAccepted> {
    const id = `${name}-${data.workspaceId}-${dedupeKey}`;
    await this.queue(queue).add(name, data, { jobId: id });
    return { jobId: `${queue}${SEPARATOR}${id}` };
  }

  async view(workspaceId: string, jobId: string): Promise<JobView> {
    const [queueName, id] = jobId.split(SEPARATOR);
    const queue = queueName ? this.queues.get(queueName) : undefined;
    const job: Job<WorkspaceJobData> | undefined =
      queue && id ? await queue.getJob(id) : undefined;
    if (!job || job.data.workspaceId !== workspaceId) {
      throw new NotFoundError("That job doesn't exist or has expired.");
    }
    const state = await job.getState();
    return {
      jobId,
      name: job.name,
      status: toStatus(state),
      progress: typeof job.progress === "number" ? job.progress : 0,
      result: state === "completed" ? job.returnvalue : null,
      error:
        state === "failed"
          ? "This task failed. Please try again or contact support."
          : null,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    };
  }

  private queue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) throw new Error(`Queue ${name} is not available to the API`);
    return queue;
  }
}

function toStatus(state: string): JobStatus {
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  if (state === "active") return "running";
  return "queued";
}
