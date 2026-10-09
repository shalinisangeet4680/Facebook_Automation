import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3.5 text-[15px] text-foreground shadow-[var(--shadow-raised)] outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-border-strong focus:border-accent focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:ring-danger/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClass, "h-auto min-h-24 resize-y py-2.5 leading-6", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small text-foreground font-medium">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
