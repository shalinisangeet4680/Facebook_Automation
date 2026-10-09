export class JobAcceptedDto {
  jobId: string;
}

export class JobResponseDto {
  jobId: string;
  name: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}
