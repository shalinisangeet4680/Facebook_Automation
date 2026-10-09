import { AlertTriangle, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Spinner } from "./spinner";

export type CheckState = "pending" | "running" | "passed" | "warning" | "failed";

const ICON_STYLES: Record<CheckState, string> = {
  pending: "border border-border bg-surface text-subtle",
  running: "bg-accent-soft text-accent",
  passed: "bg-success text-white",
  warning: "bg-warning text-white",
  failed: "bg-danger text-white",
};

export function CheckRow({
  state,
  label,
  message,
}: {
  state: CheckState;
  label: string;
  message?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300",
          ICON_STYLES[state],
        )}
      >
        {state === "running" ? (
          <Spinner className="size-3" />
        ) : state === "passed" ? (
          <Check className="size-3" strokeWidth={3} />
        ) : state === "warning" ? (
          <AlertTriangle className="size-3" strokeWidth={2.5} />
        ) : state === "failed" ? (
          <X className="size-3" strokeWidth={3} />
        ) : null}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[14px] font-medium",
            state === "pending" ? "text-subtle" : "text-foreground",
          )}
        >
          {label}
        </p>
        {message && state !== "pending" && state !== "running" ? (
          <p
            className={cn(
              "text-small",
              state === "failed"
                ? "text-danger"
                : state === "warning"
                  ? "text-warning"
                  : "text-muted",
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
