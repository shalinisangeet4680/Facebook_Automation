export class TrackingPixelDto {
  id: string;
  name: string;
  lastFiredTime: string | null;
}

export class TrackingEventCountDto {
  event: string;
  count: number;
}

export class TrackingEventDto {
  event: string;
  last24Hours: number;
  last7Days: number;
}

export class TrackingTotalsDto {
  last24Hours: number;
  last7Days: number;
}

export class TrackingGoalDto {
  goal: "traffic" | "leads" | "sales" | "awareness";
  ready: boolean;
  needs: string[];
  message: string;
  fix: string | null;
}

export class TrackingReportDto {
  selected: boolean;
  pixel: TrackingPixelDto | null;
  status: "healthy" | "warning" | "missing";
  reasons: string[];
  fixes: string[];
  warnings: string[];
  last24Hours: TrackingEventCountDto[];
  last7Days: TrackingEventCountDto[];
  events: TrackingEventDto[];
  totals: TrackingTotalsDto;
  goals: TrackingGoalDto[];
  eventsManagerUrl: string;
  checkedAt: string;
}
