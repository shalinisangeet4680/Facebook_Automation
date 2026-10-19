"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useInbox, useMe, useMetaConnection } from "@/lib/api/queries";
import { ProductShell } from "@/features/replyly/shell";
import { cx } from "@/features/replyly/ui";

const NAV = [
  ["overview", "Overview", "/setup"],
  ["campaigns", "Campaigns", "/campaigns"],
  ["creatives", "Creatives", "/creatives"],
  ["profile", "Page & Instagram", "/profile"],
  ["reports", "Reports", "/reports"],
  ["account", "Meta account", "/setup/connect-meta"],
] as const;

const NEEDS_META = new Set(["campaigns", "profile", "reports"]);

function activeOf(pathname: string) {
  if (pathname === "/setup" || pathname.startsWith("/setup/start")) return "overview";
  if (pathname.startsWith("/setup/")) return "account";
  return NAV.find(([, , href]) => pathname === href || pathname.startsWith(`${href}/`))?.[0];
}

export function useMetaConnected() {
  const connection = useMetaConnection();
  return {
    loading: connection.isPending,
    connected: connection.data?.status === "active",
    connection: connection.data,
  };
}

function NavLinks({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();
  const active = activeOf(pathname);
  const { connected, loading } = useMetaConnected();
  const inbox = useInbox();
  const waiting = inbox.data ? inbox.data.suggestions.length + inbox.data.plansToReview.length : 0;
  return (
    <>
      {NAV.map(([id, label, href]) => {
        const off = !loading && !connected && NEEDS_META.has(id);
        return (
          <Link
            key={id}
            href={off ? "/setup/connect-meta" : href}
            aria-current={active === id ? "page" : undefined}
            className={cx("rp-nav", active === id && "rp-nav-on")}
            style={mobile ? { flexShrink: 0, gap: 6 } : undefined}
          >
            <span>{label}</span>
            {id === "overview" && waiting > 0 ? (
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
                {waiting > 99 ? "99+" : waiting}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

function Footer() {
  const me = useMe();
  const { connected, connection } = useMetaConnected();
  const invalid = connection?.status === "invalid";
  return (
    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      <Link href="/claude" className="rp-nav rp-nav-small">
        Use with Claude
      </Link>
      <Link href="/home" className="rp-nav rp-nav-small">
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
        <span style={{ fontSize: 11.5, color: invalid ? "#B42318" : "#6C6962" }}>
          {invalid
            ? "Meta needs reconnecting"
            : connected
              ? `Meta connected${connection?.systemUser ? ` · ${connection.systemUser.name}` : ""}`
              : "Not connected"}
        </span>
      </div>
    </div>
  );
}

export function MetaAdsShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  return (
    <ProductShell fontClass={fontClass} product="Meta Ads" Nav={NavLinks} Footer={Footer}>
      {children}
    </ProductShell>
  );
}
