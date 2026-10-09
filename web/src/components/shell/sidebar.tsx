"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

import { NAV } from "./nav";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex-1 px-3 py-4">
        <Suspense fallback={<NavLinks pathname="" onNavigate={onNavigate} />}>
          <ActiveNavLinks onNavigate={onNavigate} />
        </Suspense>
      </nav>
      <div className="border-border bg-surface-muted m-3 rounded-[var(--radius-card)] border p-3">
        {me.data ? (
          <>
            <p className="truncate text-[14px] font-semibold">{me.data.workspace.name}</p>
            <p className="text-small text-muted capitalize">{me.data.workspace.role}</p>
          </>
        ) : (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} onNavigate={onNavigate} />;
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="grid gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const inner = (
          <>
            <Icon className="size-[18px]" />
            <span className="flex-1">{item.label}</span>
            {item.soon ? <Badge tone="outline">Soon</Badge> : null}
          </>
        );
        const base =
          "flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[14px] font-medium transition-colors";
        return (
          <li key={item.href}>
            {item.soon ? (
              <span aria-disabled className={cn(base, "text-subtle cursor-not-allowed")}>
                {inner}
              </span>
            ) : (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
