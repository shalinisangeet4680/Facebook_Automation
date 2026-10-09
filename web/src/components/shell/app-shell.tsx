"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dialog as Radix } from "radix-ui";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";

import { sectionFor } from "./nav";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      <aside className="border-border bg-surface fixed inset-y-0 left-0 hidden w-[264px] border-r lg:block">
        <SidebarContent />
      </aside>

      <Radix.Root open={open} onOpenChange={setOpen}>
        <Radix.Portal>
          <Radix.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-[fade-in_150ms_ease-out] lg:hidden" />
          <Radix.Content className="border-border bg-surface fixed inset-y-0 left-0 z-50 w-[280px] border-r shadow-[var(--shadow-floating)] outline-none data-[state=open]:animate-[drawer-in_220ms_var(--ease-out-soft)] lg:hidden">
            <Radix.Title className="sr-only">Navigation</Radix.Title>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </Radix.Content>
        </Radix.Portal>
      </Radix.Root>

      <header className="border-border bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md sm:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
        <p className="text-[15px] font-semibold">
          <Suspense>
            <SectionTitle />
          </Suspense>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}

function SectionTitle() {
  const pathname = usePathname();
  return sectionFor(pathname)?.label ?? "";
}
