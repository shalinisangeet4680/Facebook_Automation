"use client";

import { Check } from "lucide-react";
import { RadioGroup as Radix } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function RadioCardGroup({ className, ...props }: ComponentProps<typeof Radix.Root>) {
  return <Radix.Root className={cn("grid content-start gap-3", className)} {...props} />;
}

export function RadioCard({
  value,
  title,
  description,
  meta,
  icon,
  disabled,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Radix.Item
      value={value}
      disabled={disabled}
      className={cn(
        "group border-border bg-surface relative flex w-full items-start gap-3 rounded-[var(--radius-card)] border p-4 text-left shadow-[var(--shadow-raised)] transition-[border-color,box-shadow,background-color] outline-none",
        "hover:border-border-strong focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft/40 data-[state=checked]:ring-accent data-[state=checked]:ring-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {icon ? (
        <span className="bg-surface-muted text-muted grid size-10 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)]">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[14px] font-semibold">{title}</span>
        {description ? (
          <span className="text-small text-muted mt-0.5 block truncate">{description}</span>
        ) : null}
        {meta ? <span className="mt-2 flex flex-wrap gap-1.5">{meta}</span> : null}
      </span>
      <span className="border-border-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent grid size-5 shrink-0 place-items-center rounded-full border transition-colors">
        <Radix.Indicator>
          <Check className="text-accent-foreground size-3" strokeWidth={3} />
        </Radix.Indicator>
      </span>
    </Radix.Item>
  );
}
