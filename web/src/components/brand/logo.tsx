import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M16 24V8.5M16 18.5l-5.5-5.5M16 15.5l5.5-5.5"
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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
