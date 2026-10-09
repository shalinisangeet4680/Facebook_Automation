import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="bg-surface-muted text-muted grid size-12 place-items-center rounded-full">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      {description ? <p className="text-small text-muted mt-1 max-w-sm">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/30 bg-danger-soft flex flex-col items-center rounded-[var(--radius-card)] border px-6 py-8 text-center",
        className,
      )}
    >
      <AlertCircle className="text-danger size-5" />
      <p className="text-foreground mt-3 text-[14px] font-medium">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
