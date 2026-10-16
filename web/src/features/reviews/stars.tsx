import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${value} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            "size-3.5",
            n <= value ? "fill-amber-400 text-amber-400" : "text-border-strong",
          )}
        />
      ))}
    </span>
  );
}

export function Rating({
  value,
  previous,
  compact,
}: {
  value: number | null;
  previous: number | null;
  compact?: boolean;
}) {
  if (value === null) return <span className="text-muted text-small">No ratings yet</span>;
  const change = previous === null ? null : Math.round((value - previous) * 100) / 100;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[20px] font-semibold">{value.toFixed(1)}</span>
      <Star aria-hidden className="size-4 translate-y-0.5 fill-amber-400 text-amber-400" />
      {change !== null && change !== 0 ? (
        <span
          className={cn(
            "text-small font-medium whitespace-nowrap",
            change > 0 ? "text-success" : "text-danger",
          )}
          title={`${change > 0 ? "+" : ""}${change.toFixed(2)} vs the 30 days before`}
          aria-label={`${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(2)} vs the 30 days before`}
        >
          {change > 0 ? "▲ +" : "▼ "}
          {change.toFixed(2)}
          {compact ? "" : " vs last 30 days"}
        </span>
      ) : null}
    </span>
  );
}
