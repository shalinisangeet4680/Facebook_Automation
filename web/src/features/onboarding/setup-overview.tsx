"use client";

import { ArrowRight, Check, ChevronRight, Lock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { useOnboarding } from "@/lib/api/queries";
import type { OnboardingStep } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { STEP_ROUTES } from "./step-routes";

function StepIcon({ step }: { step: OnboardingStep }) {
  if (step.status === "completed") {
    return (
      <span className="bg-success grid size-8 place-items-center rounded-full text-white">
        <Check className="size-4" strokeWidth={3} />
      </span>
    );
  }
  if (step.status === "current" && step.available) {
    return (
      <span className="bg-accent text-accent-foreground relative grid size-8 place-items-center rounded-full text-[13px] font-semibold">
        <span className="bg-accent/30 absolute inset-0 animate-ping rounded-full" />
        {step.order}
      </span>
    );
  }
  if (!step.available) {
    return (
      <span className="border-border bg-surface-muted text-subtle grid size-8 place-items-center rounded-full border">
        <Lock className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="border-border bg-surface text-muted grid size-8 place-items-center rounded-full border text-[13px] font-semibold">
      {step.order}
    </span>
  );
}

function StepRow({ step, index }: { step: OnboardingStep; index: number }) {
  const href = STEP_ROUTES[step.id];
  const linked = Boolean(href) && step.available && step.status !== "upcoming";
  const content = (
    <>
      <StepIcon step={step} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] font-semibold", step.status === "upcoming" && "text-muted")}>
          {step.title}
        </p>
        <p className="text-small text-muted mt-0.5">{step.description}</p>
      </div>
      {step.status === "completed" ? (
        <Badge tone="success">Done</Badge>
      ) : step.status === "current" && step.available ? (
        <Badge tone="accent">Next</Badge>
      ) : !step.available ? (
        <Badge tone="outline">Coming soon</Badge>
      ) : null}
      {linked ? <ChevronRight className="text-subtle size-4" /> : null}
    </>
  );
  const className = "flex items-center gap-4 px-5 py-4 transition-colors sm:px-6";
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {linked ? (
        <Link href={href!} className={cn(className, "hover:bg-surface-muted")}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </motion.li>
  );
}

function NextUp({
  steps,
  completed,
  total,
}: {
  steps: OnboardingStep[];
  completed: number;
  total: number;
}) {
  const current = steps.find((s) => s.status === "current");
  const href = current ? STEP_ROUTES[current.id] : undefined;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <ProgressRing value={completed} total={total} size={96} />
        <div className="min-w-0 flex-1">
          {current ? (
            <>
              <p className="text-caption text-accent font-semibold tracking-wide uppercase">
                Next up · Step {current.order}
              </p>
              <h2 className="text-heading mt-1.5 font-semibold">{current.title}</h2>
              <p className="text-muted mt-1">{current.description}</p>
            </>
          ) : (
            <>
              <p className="text-caption text-success font-semibold tracking-wide uppercase">
                All set
              </p>
              <h2 className="text-heading mt-1.5 font-semibold">Your workspace is ready</h2>
            </>
          )}
        </div>
        {current && href && current.available ? (
          <Button asChild size="lg">
            <Link href={href}>
              Continue <ArrowRight />
            </Link>
          </Button>
        ) : current && !current.available ? (
          <Button size="lg" variant="secondary" disabled>
            Coming soon
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-6">
      <Card className="flex items-center gap-6 p-8">
        <Skeleton className="size-24 rounded-full" />
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </Card>
      <Card className="divide-border divide-y">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <Skeleton className="size-8 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function SetupOverview() {
  const onboarding = useOnboarding();
  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="accent">Getting started</Badge>}
        title="Set up your workspace"
        description="Connect your Meta business and tell us about your goals. We'll handle the rest, and you approve every launch and budget change."
      />
      {onboarding.isPending ? (
        <LoadingState />
      ) : onboarding.isError ? (
        <ErrorState
          message={errorMessage(onboarding.error)}
          onRetry={() => void onboarding.refetch()}
        />
      ) : (
        <div className="grid gap-6">
          <NextUp
            steps={onboarding.data.steps}
            completed={onboarding.data.completedCount}
            total={onboarding.data.totalCount}
          />
          <Card>
            <div className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-6">
              <h3 className="text-[15px] font-semibold">All steps</h3>
              <span className="text-small text-muted tabular-nums">
                {onboarding.data.completedCount} of {onboarding.data.totalCount} complete
              </span>
            </div>
            <ol className="divide-border divide-y">
              {onboarding.data.steps.map((step, i) => (
                <StepRow key={step.id} step={step} index={i} />
              ))}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
