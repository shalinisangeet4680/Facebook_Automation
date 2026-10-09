"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Check,
  Loader2,
  PencilRuler,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuthorizationContext, useAuthorizationDecision } from "@/lib/api/queries";
import type { AuthorizationQuery } from "@/lib/api/types";
import { BRAND } from "@/lib/config";

const REQUIRED = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
] as const;
const OPTIONAL = ["state", "scope", "resource"] as const;

function readQuery(params: URLSearchParams): AuthorizationQuery | null {
  const values: Record<string, string> = {};
  for (const key of REQUIRED) {
    const value = params.get(key);
    if (!value) return null;
    values[key] = value;
  }
  for (const key of OPTIONAL) {
    const value = params.get(key);
    if (value) values[key] = value;
  }
  return values as AuthorizationQuery;
}

function isLoopback(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

function leave(url: string) {
  window.location.replace(url);
}

export function ConsentScreen() {
  const params = useSearchParams();
  const query = useMemo(() => readQuery(new URLSearchParams(params.toString())), [params]);
  if (!query) {
    return (
      <Problem
        title="This link is incomplete"
        message="Start the connection again from Claude. If it keeps happening, remove the connector in Claude and add it again."
      />
    );
  }
  return <Consent query={query} />;
}

function Consent({ query }: { query: AuthorizationQuery }) {
  const context = useAuthorizationContext(query);
  const decision = useAuthorizationDecision();
  const [allowWrite, setAllowWrite] = useState(true);
  const [leaving, setLeaving] = useState<"approve" | "deny" | null>(null);
  const writeId = useId();

  if (context.isPending) return <ConsentSkeleton />;
  if (context.isError) {
    const err = context.error;
    const back =
      err instanceof ApiError ? (err.details.redirectTo as string | undefined) : undefined;
    return (
      <Problem
        title="We can't complete this connection"
        message={errorMessage(err)}
        action={
          back ? (
            <Button variant="secondary" onClick={() => leave(back)}>
              Return to the app
            </Button>
          ) : undefined
        }
      />
    );
  }

  const data = context.data;
  const loopback = isLoopback(data.redirectHost);
  const decide = (approve: boolean) => {
    setLeaving(approve ? "approve" : "deny");
    decision.mutate(
      { ...query, approve, allowWrite: approve && data.writeRequested && allowWrite },
      {
        onSuccess: ({ redirectTo }) => leave(redirectTo),
        onError: () => setLeaving(null),
      },
    );
  };

  if (leaving && decision.isSuccess) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <Loader2 className="text-accent mx-auto size-6 animate-spin" />
        <p className="mt-4 font-semibold">
          {leaving === "approve"
            ? `Connected. Returning to ${data.client.name}…`
            : "Cancelled. Returning…"}
        </p>
        <p className="text-small text-muted mt-1">You can close this tab if nothing happens.</p>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md"
    >
      <Card className="overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-center gap-3">
            <LogoMark className="size-11" />
            <ArrowLeftRight className="text-subtle size-4" aria-hidden />
            <span className="bg-surface-muted border-border text-foreground grid size-11 place-items-center rounded-[10px] border text-lg font-semibold">
              {data.client.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <h1 className="text-heading mt-6 text-center font-semibold tracking-tight">
            Connect {data.client.name} to {BRAND.name}
          </h1>
          <p className="text-small text-muted mt-2 text-center">
            {data.client.name} will work with the{" "}
            <strong className="text-foreground font-medium">{data.workspace.name}</strong> workspace
            {data.adAccount ? (
              <>
                {" "}
                and the ad account{" "}
                <strong className="text-foreground font-medium">{data.adAccount.name}</strong>
              </>
            ) : null}
            .
          </p>

          <ul className="border-border divide-border mt-6 divide-y rounded-xl border">
            <li className="flex gap-3 p-4">
              <BarChart3 className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-[14px] font-medium">See your ads and results</p>
                <p className="text-small text-muted">
                  Campaigns, spend, leads, cost per result and Pixel tracking.
                </p>
              </div>
              <Check className="text-success ml-auto size-4 shrink-0" aria-label="Included" />
            </li>
            {data.writeRequested ? (
              <li>
                <label htmlFor={writeId} className="flex cursor-pointer gap-3 p-4">
                  <PencilRuler className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                  <div>
                    <p className="text-[14px] font-medium">Prepare and manage campaigns</p>
                    <p className="text-small text-muted">
                      Create paused drafts and pause ads. Turning ads on or changing budgets always
                      asks you first.
                    </p>
                  </div>
                  <input
                    id={writeId}
                    type="checkbox"
                    checked={allowWrite}
                    onChange={(e) => setAllowWrite(e.target.checked)}
                    className="mt-1 ml-auto size-4 shrink-0 accent-[var(--accent)]"
                  />
                </label>
              </li>
            ) : null}
          </ul>

          {loopback ? (
            <div
              role="note"
              className="bg-warning-soft text-warning mt-4 flex gap-2 rounded-lg p-3 text-[13px]"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                This app runs on your computer ({data.redirectHost}). Only continue if you just
                started this from Claude Code.
              </span>
            </div>
          ) : null}

          {decision.isError ? (
            <p role="alert" className="text-danger mt-4 text-center text-[13px]">
              {errorMessage(decision.error)}
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="lg"
              disabled={decision.isPending}
              loading={leaving === "deny" && decision.isPending}
              onClick={() => decide(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={decision.isPending}
              loading={leaving === "approve" && decision.isPending}
              onClick={() => decide(true)}
            >
              Allow
            </Button>
          </div>
        </div>
        <div className="bg-surface-muted border-border text-caption text-muted flex items-start gap-2 border-t px-6 py-4 sm:px-8">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            You&apos;ll return to{" "}
            <strong className="text-foreground font-medium">{data.redirectHost}</strong>. Your Meta
            token stays with {BRAND.name}. Disconnect any time from Claude settings in {BRAND.name}.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

function ConsentSkeleton() {
  return (
    <Card className="w-full max-w-md p-8" aria-busy="true" aria-label="Loading">
      <div className="flex justify-center gap-3">
        <Skeleton className="size-11 rounded-[10px]" />
        <Skeleton className="size-11 rounded-[10px]" />
      </div>
      <Skeleton className="mx-auto mt-6 h-6 w-3/4" />
      <Skeleton className="mx-auto mt-3 h-4 w-2/3" />
      <Skeleton className="mt-6 h-36 w-full rounded-xl" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </Card>
  );
}

function Problem({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-md p-8 text-center" role="alert">
      <span className="bg-danger-soft text-danger mx-auto grid size-12 place-items-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h1 className="text-heading mt-4 font-semibold">{title}</h1>
      <p className="text-small text-muted mt-2">{message}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  );
}
