"use client";

import { DropdownMenu as Radix } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const DropdownMenu = Radix.Root;
export const DropdownMenuTrigger = Radix.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content
        sideOffset={sideOffset}
        className={cn(
          "border-border bg-surface z-50 min-w-52 rounded-[var(--radius-card)] border p-1.5 shadow-[var(--shadow-floating)] data-[state=open]:animate-[pop-in_150ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      />
    </Radix.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof Radix.Item> & { destructive?: boolean }) {
  return (
    <Radix.Item
      className={cn(
        "data-[highlighted]:bg-surface-muted [&_svg]:text-muted flex cursor-default items-center gap-2 rounded-[6px] px-2.5 py-2 text-[14px] outline-none select-none [&_svg]:size-4",
        destructive && "text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Radix.Label>) {
  return <Radix.Label className={cn("px-2.5 py-2", className)} {...props} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Radix.Separator>) {
  return <Radix.Separator className={cn("bg-border my-1 h-px", className)} {...props} />;
}
