import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-[14px] border shadow-[var(--shadow-floating)]">
      <div className="border-border bg-surface-muted flex h-10 items-center gap-3 border-b px-3.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="bg-surface text-caption text-muted mx-auto flex h-6 max-w-[70%] min-w-0 items-center gap-1.5 rounded-[6px] px-3">
          <Lock className="size-3 shrink-0" />
          <span className="truncate">{url}</span>
        </span>
        <span className="w-[38px]" />
      </div>
      <div className="relative aspect-[16/10] overflow-hidden bg-[#f6f7f9] text-[#1c1e21] dark:bg-[#18191a] dark:text-[#e4e6eb]">
        {children}
      </div>
    </div>
  );
}
