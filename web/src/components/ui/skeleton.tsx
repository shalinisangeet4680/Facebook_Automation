import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("bg-surface-sunken animate-pulse rounded-[var(--radius-control)]", className)}
      {...props}
    />
  );
}
