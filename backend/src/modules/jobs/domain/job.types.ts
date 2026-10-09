export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobView {
  jobId: string;
  name: string;
  status: JobStatus;
  progress: number;
  result: unknown;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface JobAccepted {
  jobId: string;
}
