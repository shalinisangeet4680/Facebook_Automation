"use client";

import { X } from "lucide-react";
import { Dialog as Radix } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Dialog = Radix.Root;
export const DialogTrigger = Radix.Trigger;
export const DialogClose = Radix.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: ComponentProps<typeof Radix.Content> & { title: ReactNode; description?: ReactNode }) {
  return (
    <Radix.Portal>
      <Radix.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <Radix.Content
        className={cn(
          "border-border bg-surface fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-panel)] border p-6 shadow-[var(--shadow-floating)] outline-none data-[state=open]:animate-[dialog-in_220ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      >
        <Radix.Title className="text-heading font-semibold">{title}</Radix.Title>
        {description ? (
          <Radix.Description className="text-small text-muted mt-1">
            {description}
          </Radix.Description>
        ) : null}
        <div className="mt-5">{children}</div>
        <Radix.Close
          aria-label="Close"
          className="text-muted hover:bg-surface-muted hover:text-foreground absolute top-4 right-4 grid size-8 place-items-center rounded-[var(--radius-control)] transition-colors"
        >
          <X className="size-4" />
        </Radix.Close>
      </Radix.Content>
    </Radix.Portal>
  );
}
