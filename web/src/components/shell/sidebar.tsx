"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, usePlayApps } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

import { NAV, type NavItem } from "./nav";

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

function useBadge(kind: NavItem["badge"]) {
  const apps = usePlayApps();
  if (kind !== "reviews" || !apps.data) return 0;
  return apps.data.data.reduce((n, a) => n + a.needsReply, 0);
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const badge = useBadge(item.badge);
  const Icon = item.icon;
  const base =
    "flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[14px] font-medium transition-colors";
  const inner = (
    <>
      <Icon className="size-[18px]" />
      <span className="flex-1">{item.label}</span>
      {item.soon ? <Badge tone="outline">Soon</Badge> : null}
      {badge ? (
        <span
          className="bg-accent text-accent-foreground min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums"
          aria-label={`${badge} need a reply`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );
  if (item.soon)
    return (
      <span aria-disabled className={cn(base, "text-subtle cursor-not-allowed")}>
        {inner}
      </span>
    );
  return (
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
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const groups: { label: string | null; items: NavItem[] }[] = [];
  for (const item of NAV) {
    const label = item.group ?? null;
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return (
    <div className="grid gap-4">
      {groups.map((g, i) => (
        <div key={`${g.label ?? "main"}-${i}`}>
          {g.label ? (
            <p className="text-subtle mb-1 px-3 text-[11px] font-semibold tracking-wider uppercase">
              {g.label}
            </p>
          ) : null}
          <ul className="grid gap-0.5">
            {g.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
