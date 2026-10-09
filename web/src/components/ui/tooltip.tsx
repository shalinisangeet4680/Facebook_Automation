"use client";

import { Tooltip as Radix } from "radix-ui";
import type { ReactNode } from "react";

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Radix.Provider delayDuration={250}>
      <Radix.Root>
        <Radix.Trigger asChild>{children}</Radix.Trigger>
        <Radix.Portal>
          <Radix.Content
            sideOffset={6}
            className="bg-foreground text-caption text-background z-50 rounded-[6px] px-2.5 py-1.5 shadow-[var(--shadow-floating)] data-[state=delayed-open]:animate-[pop-in_120ms_ease-out]"
          >
            {content}
          </Radix.Content>
        </Radix.Portal>
      </Radix.Root>
    </Radix.Provider>
  );
}
