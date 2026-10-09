import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { Spinner } from "./spinner";

const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-[var(--shadow-raised)] hover:bg-accent-hover",
        secondary:
          "border border-border bg-surface text-foreground shadow-[var(--shadow-raised)] hover:border-border-strong hover:bg-surface-muted",
        ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
        danger: "bg-danger text-white hover:opacity-90",
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-small [&_svg]:size-3.5",
        md: "h-10 px-4 text-[14px] [&_svg]:size-4",
        lg: "h-12 px-5 text-[15px] [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { buttonVariants };
