export class SuggestionDto {
  id: string;
  rule: string;
  severity: "critical" | "warning" | "opportunity";
  entityType: string;
  entityId: string;
  entityName: string;
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  action: Record<string, unknown>;
  status: "open" | "applied" | "dismissed" | "snoozed" | "expired";
  snoozedUntil: string | null;
  createdAt: string;
}

export class PlanToReviewDto {
  id: string;
  name: string;
  source: string;
  createdAt: string;
}

export class FailedPostDto {
  id: string;
  status:
    | "scheduled"
    | "publishing"
    | "published"
    | "partially_published"
    | "failed"
    | "cancelled";
  facebookError: string | null;
  instagramError: string | null;
  caption: string;
  updatedAt: string;
}

export class InboxDto {
  suggestions: SuggestionDto[];
  plansToReview: PlanToReviewDto[];
  failedPosts: FailedPostDto[];
}

export class RefreshResultDto {
  created: number;
  open: number;
}
