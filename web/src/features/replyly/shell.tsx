"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { useMe, usePlayApps, usePlayConnections, usePlayInbox } from "@/lib/api/queries";

import { APP_COLORS } from "./tokens";
import { ToastProvider } from "./ui";

const NAV = [
  ["apps", "Apps", "/reviews"],
  ["inbox", "Inbox", "/reviews/inbox"],
  ["templates", "Templates", "/reviews/templates"],
  ["analytics", "Analytics", "/reviews/analytics"],
  ["mcp", "MCP", "/reviews/mcp"],
] as const;

function activeOf(pathname: string) {
  const part = pathname.split("/")[2];
  if (!part || part === "connect") return "apps";
  if (["inbox", "templates", "analytics", "mcp", "states"].includes(part)) return part;
  return "apps";
}

export function useConnected() {
  const connections = usePlayConnections();
  return {
    loading: connections.isPending,
    connected: Boolean(connections.data?.data.length),
    connections: connections.data?.data ?? [],
  };
}

export function useAppColors() {
  const apps = usePlayApps();
  const list = apps.data?.data ?? [];
  return {
    apps: list,
    color: (id: string) => {
      const i = list.findIndex((a) => a.id === id);
      return APP_COLORS[(i < 0 ? 0 : i) % APP_COLORS.length]!;
    },
  };
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "#191917",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--rp-serif)",
          fontStyle: "italic",
          fontSize: 19,
        }}
      >
        r
      </span>
      <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-.01em" }}>Replyly</span>
    </div>
  );
}

function NavLinks({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();
  const active = activeOf(pathname);
  const { connected, loading } = useConnected();
  const pending = usePlayInbox("pending").data?.counts.pending ?? 0;
  return (
    <>
      {NAV.map(([id, label, href]) => {
        const off = !loading && !connected && id !== "mcp" && id !== "apps";
        const target = id === "apps" && !loading && !connected ? "/reviews/connect" : href;
        return (
          <Link
            key={id}
            href={target}
            aria-current={active === id ? "page" : undefined}
            aria-disabled={off || undefined}
            tabIndex={off ? -1 : undefined}
            className={`rp-nav${active === id ? "rp-nav-on" : ""}${off ? "rp-nav-off" : ""}`}
            style={mobile ? { flexShrink: 0, gap: 6 } : undefined}
          >
            <span>{label}</span>
            {id === "inbox" && connected && pending > 0 ? (
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
    </>
  );
}

function Footer() {
  const pathname = usePathname();
  const me = useMe();
  const apps = usePlayApps();
  const { connected } = useConnected();
  const n = apps.data?.data.length ?? 0;
  return (
    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      <Link href="/setup" className="rp-nav rp-nav-small">
        ← Back to Autopilot
      </Link>
      <Link
        href="/reviews/states"
        className={`rp-nav rp-nav-small${activeOf(pathname) === "states" ? "rp-nav-on" : ""}`}
      >
        System states
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
          {connected ? `${n} app${n === 1 ? "" : "s"} · Play connected` : "Not connected"}
        </span>
      </div>
    </div>
  );
}

export function ReplylyShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  return (
    <div className={`rp ${fontClass}`}>
      <ToastProvider>
        <aside className="rp-aside" aria-label="Replyly">
          <Logo />
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Suspense>
              <NavLinks />
            </Suspense>
          </nav>
          <Suspense>
            <Footer />
          </Suspense>
        </aside>
        <nav className="rp-mobile-bar" aria-label="Replyly">
          <span style={{ marginRight: 8 }}>
            <Logo />
          </span>
          <Suspense>
            <NavLinks mobile />
          </Suspense>
          <Link href="/reviews/states" className="rp-nav rp-nav-small" style={{ flexShrink: 0 }}>
            States
          </Link>
        </nav>
        <main className="rp-main">
          <div className="rp-wrap">{children}</div>
        </main>
      </ToastProvider>
    </div>
  );
}
