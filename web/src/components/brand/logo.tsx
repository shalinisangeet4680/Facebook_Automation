import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M9 21.5 15.2 9.6c.3-.6 1.2-.6 1.5 0L23 21.5"
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.8 17.2h8.4"
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "text-[17px] font-semibold tracking-tight",
          inverted ? "text-white" : "text-foreground",
        )}
      >
        {BRAND.name}
      </span>
    </span>
  );
}
