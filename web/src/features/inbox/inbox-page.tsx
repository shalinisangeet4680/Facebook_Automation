"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BellOff,
  CheckCircle2,
  Clock,
  Inbox as InboxIcon,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { useInbox, useRefreshInbox, useSuggestionAction } from "@/lib/api/queries";
import type { Suggestion } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const SEVERITY = {
  critical: {
    label: "Urgent",
    tone: "danger" as const,
    icon: AlertOctagon,
    color: "text-danger bg-danger-soft",
  },
  warning: {
    label: "Needs attention",
    tone: "warning" as const,
    icon: AlertTriangle,
    color: "text-warning bg-warning-soft",
  },
  opportunity: {
    label: "Opportunity",
    tone: "success" as const,
    icon: TrendingUp,
    color: "text-success bg-success-soft",
  },
};

const EVIDENCE_LABELS: Record<string, string> = {
  spend: "Spend",
  results: "Results",
  target: "Target cost",
  costPerResult: "Cost per result",
  reference: "Benchmark",
  frequency: "Frequency",
  ctr: "CTR %",
  previousCtr: "Last week CTR %",
  linkClicks: "Link clicks",
  landingPageViews: "Page views",
  spendShare: "Budget used",
  eventsLast24h: "Events in 24h",
  monthSpend: "Spent this month",
  projected: "Projected",
  monthlyBudget: "Monthly budget",
};

const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const MONEY_KEYS = new Set([
  "spend",
  "target",
  "costPerResult",
  "reference",
  "monthSpend",
  "projected",
  "monthlyBudget",
]);

function formatEvidence(key: string, value: unknown, money: Intl.NumberFormat): string {
  const n = Number(value);
  if (key === "spendShare") return `${Math.round(n * 100)}%`;
  if (MONEY_KEYS.has(key) && Number.isFinite(n)) return money.format(n);
  return String(value);
}

function actionLabel(action: Suggestion["action"], money: Intl.NumberFormat): string | null {
  if (action.type === "pause") return "Pause ad";
  if (action.type === "set_daily_budget") return `Set budget to ${money.format(Number(action.to))}`;
  return null;
}

export function InboxPage() {
  const inbox = useInbox();
  const refresh = useRefreshInbox();

  return (
    <>
      <PageHeader
        title="Inbox"
        description="What needs your attention. TreeVook checks your ads every morning at 7:30 and suggests what to change."
        actions={
          <Button
            variant="secondary"
            loading={refresh.isPending}
            onClick={() =>
              refresh.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success(
                    r.created
                      ? `${r.created} new suggestion${r.created === 1 ? "" : "s"}`
                      : "Checked. Nothing new.",
                  ),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            <RefreshCw /> Check now
          </Button>
        }
      />
      {inbox.isPending ? (
        <div className="grid gap-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : inbox.isError ? (
        <ErrorState message={errorMessage(inbox.error)} onRetry={() => void inbox.refetch()} />
      ) : (
        <div className="grid gap-8">
          {inbox.data.plansToReview.length || inbox.data.failedPosts.length ? (
            <section aria-labelledby="todo" className="grid gap-3">
              <h2 id="todo" className="text-[15px] font-semibold">
                Waiting for you
              </h2>
              {inbox.data.plansToReview.map((p) => (
                <Card key={p.id} className="flex items-center gap-4 p-4">
                  <span className="bg-accent-soft text-accent grid size-9 shrink-0 place-items-center rounded-full">
                    <Clock className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">Review plan: {p.name}</p>
                    <p className="text-caption text-muted">
                      {p.source.startsWith("mcp:") ? `From ${p.source.slice(4)}` : "From TreeVook"}{" "}
                      · {date.format(new Date(p.createdAt))}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/campaigns/plans/${p.id}`}>
                      Review <ArrowRight />
                    </Link>
                  </Button>
                </Card>
              ))}
              {inbox.data.failedPosts.map((p) => (
                <Card key={p.id} className="flex items-center gap-4 p-4">
                  <span className="bg-danger-soft text-danger grid size-9 shrink-0 place-items-center rounded-full">
                    <AlertTriangle className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      Post {p.status === "failed" ? "failed" : "partly failed"}: {p.caption}
                    </p>
                    <p className="text-caption text-danger truncate">
                      {p.instagramError ?? p.facebookError}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/creatives">Open</Link>
                  </Button>
                </Card>
              ))}
            </section>
          ) : null}

          <section aria-labelledby="suggestions" className="grid gap-3">
            <h2 id="suggestions" className="text-[15px] font-semibold">
              Suggestions
            </h2>
            {inbox.data.suggestions.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<CheckCircle2 className="size-5" />}
                  title="All clear"
                  description="Nothing needs changing right now. Set a target cost per result in Settings for sharper suggestions."
                />
              </Card>
            ) : (
              inbox.data.suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} />)
            )}
          </section>
        </div>
      )}
      {inbox.data && !inbox.data.suggestions.length && !inbox.data.plansToReview.length ? (
        <p className="text-caption text-muted mt-6 flex items-center gap-1.5">
          <InboxIcon className="size-3.5" aria-hidden /> Suggestions use the last 7 days compared
          with the 7 before.
        </p>
      ) : null}
    </>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const act = useSuggestionAction();
  const severity = SEVERITY[suggestion.severity];
  const Icon = severity.icon;

  const run = (action: "apply" | "dismiss" | "snooze", done: string) =>
    act.mutate(
      { id: suggestion.id, action },
      { onSuccess: () => toast.success(done), onError: (err) => toast.error(errorMessage(err)) },
    );
  const currency =
    typeof suggestion.evidence.currency === "string" ? suggestion.evidence.currency : "INR";
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const label = actionLabel(suggestion.action, money);
  const evidence = Object.entries(suggestion.evidence).filter(
    ([k, v]) => k !== "currency" && v !== null && v !== undefined,
  );

  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <span
          className={cn("grid size-10 shrink-0 place-items-center rounded-full", severity.color)}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severity.tone}>{severity.label}</Badge>
            <span className="text-caption text-muted">{suggestion.entityName}</span>
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold">{suggestion.title}</h3>
          <p className="text-small text-muted mt-1">{suggestion.body}</p>
          {evidence.length ? (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {evidence.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-caption text-muted">{EVIDENCE_LABELS[key] ?? key}</dt>
                  <dd className="text-[14px] font-medium tabular-nums">
                    {formatEvidence(key, value, money)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {label ? (
              <Button
                size="sm"
                loading={act.isPending && act.variables?.action === "apply"}
                onClick={() => run("apply", "Done")}
              >
                {label}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={act.isPending}
              onClick={() => run("snooze", "Snoozed for 7 days")}
            >
              <BellOff /> Snooze
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={act.isPending}
              onClick={() => run("dismiss", "Dismissed")}
            >
              <X /> {label ? "Dismiss" : "Done"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
