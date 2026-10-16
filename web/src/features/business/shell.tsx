"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useMe } from "@/lib/api/queries";
import { useBusinessConnections, useBusinessInbox, useLocations } from "@/lib/api/business";
import { ProductShell } from "@/features/replyly/shell";
import { APP_COLORS } from "@/features/replyly/tokens";
import { cx } from "@/features/replyly/ui";

const NAV = [
  ["dashboard", "Dashboard", "/business"],
  ["locations", "Locations", "/business/locations"],
  ["posts", "Posts", "/business/posts"],
  ["templates", "Templates", "/business/templates"],
] as const;

function activeOf(pathname: string) {
  const part = pathname.split("/")[2];
  if (!part) return "dashboard";
  if (["posts", "templates", "connect"].includes(part)) return part;
  return "locations";
}

export function useGoogleConnected() {
  const connections = useBusinessConnections();
  return {
    loading: connections.isPending,
    connected: Boolean(connections.data?.data.length),
    connections: connections.data?.data ?? [],
  };
}

export function useLocationColors() {
  const locations = useLocations();
  const list = locations.data?.data ?? [];
  return {
    locations: list,
    color: (id: string) => {
      const i = list.findIndex((l) => l.id === id);
      return APP_COLORS[(i < 0 ? 0 : i) % APP_COLORS.length]!;
    },
  };
}

function NavLinks({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();
  const active = activeOf(pathname);
  const { connected, loading } = useGoogleConnected();
  const pending = useBusinessInbox("pending").data?.counts.pending ?? 0;
  return (
    <>
      {NAV.map(([id, label, href]) => {
        const target = !loading && !connected ? "/business/connect" : href;
        return (
          <Link
            key={id}
            href={target}
            aria-current={active === id ? "page" : undefined}
            className={cx("rp-nav", active === id && "rp-nav-on")}
            style={mobile ? { flexShrink: 0, gap: 6 } : undefined}
          >
            <span>{label}</span>
            {id === "dashboard" && connected && pending > 0 ? (
              <span
                style={{
                  minWidth: 18,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: "#191917",
                  color: "#fff",
                  fontSize: 11,
                  fontFamily: "var(--rp-mono)",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                {pending > 99 ? "99+" : pending}
              </span>
            ) : null}
          </Link>
        );
      })}
      <Link
        href="/business/connect"
        aria-current={active === "connect" ? "page" : undefined}
        className={cx("rp-nav", active === "connect" && "rp-nav-on")}
        style={mobile ? { flexShrink: 0 } : undefined}
      >
        <span>Google account</span>
      </Link>
    </>
  );
}

function Footer() {
  const me = useMe();
  const locations = useLocations();
  const { connected } = useGoogleConnected();
  const n = locations.data?.data.length ?? 0;
  return (
    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      <Link href="/reviews" className="rp-nav rp-nav-small">
        Play Reviews
      </Link>
      <Link href="/setup" className="rp-nav rp-nav-small">
        ← All TreeVook products
      </Link>
      <div
        style={{
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          borderTop: "1px solid #E6E4DF",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 500 }}>
          {me.data?.workspace.name ?? "Workspace"}
        </span>
        <span style={{ fontSize: 11.5, color: "#6C6962" }}>
          {connected ? `${n} location${n === 1 ? "" : "s"} · Google connected` : "Not connected"}
        </span>
      </div>
    </div>
  );
}

export function BusinessShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  return (
    <ProductShell fontClass={fontClass} product="Google Business" Nav={NavLinks} Footer={Footer}>
      {children}
    </ProductShell>
  );
}
