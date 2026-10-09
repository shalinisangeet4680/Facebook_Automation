"use client";

import { ChevronRight, Megaphone, Sparkles } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { usePlans } from "@/lib/api/queries";

import { GOAL_LABELS, STATUS_LABELS, sourceLabel } from "./labels";

const PROMPT =
  "Plan a new Meta campaign for my business. Look at my account, past results and website, ask me anything you need, then propose the plan with your reasons for every setting.";

const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function PlansList() {
  const plans = usePlans();
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Claude proposes every setting with its reasons. You review, adjust and launch here."
      />
      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="bg-accent-soft text-accent grid size-11 shrink-0 place-items-center rounded-full">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Plan a campaign with Claude</h2>
            <p className="text-small text-muted mt-0.5">
              In Claude with the Autopilot connector on, paste this. The plan appears here for
              review.
            </p>
            <p className="bg-surface-muted border-border mt-3 rounded-lg border px-3 py-2 text-[13px]">
              {PROMPT}
            </p>
          </div>
          <CopyButton value={PROMPT} label="Copy prompt" className="self-start sm:self-center" />
        </div>
      </Card>

      <Card>
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-[15px] font-semibold">Plans</h2>
        </div>
        {plans.isPending ? (
          <div className="grid gap-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : plans.isError ? (
          <ErrorState
            className="m-5"
            message={errorMessage(plans.error)}
            onRetry={() => void plans.refetch()}
          />
        ) : plans.data.data.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="No plans yet"
            description="Ask Claude to plan a campaign. It will show up here for you to review."
            action={
              <Button asChild variant="secondary">
                <Link href="/claude">Set up Claude</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {plans.data.data.map((plan) => {
              const status = STATUS_LABELS[plan.status];
              return (
                <li key={plan.id}>
                  <Link
                    href={`/campaigns/plans/${plan.id}`}
                    className="hover:bg-surface-muted focus-visible:bg-surface-muted flex items-center gap-4 px-5 py-4 transition-colors outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-medium">{plan.name}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="text-caption text-muted mt-0.5">
                        {GOAL_LABELS[plan.goal]?.title ?? plan.goal} · {sourceLabel(plan.source)} ·{" "}
                        {date.format(new Date(plan.createdAt))}
                      </p>
                    </div>
                    <ChevronRight className="text-subtle size-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
