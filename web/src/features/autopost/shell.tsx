"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { type SocialPlatform, useAutopostAccounts } from "@/lib/api/autopost";
import { useMe } from "@/lib/api/queries";
import { ProductShell } from "@/features/replyly/shell";
import { APP_COLORS } from "@/features/replyly/tokens";
import { cx } from "@/features/replyly/ui";

import { PLATFORMS } from "./platform";

const NAV = [
  ["calendar", "Calendar", ""],
  ["posts", "Posts", "/posts"],
  ["comments", "Comments", "/comments"],
  ["insights", "Insights", "/insights"],
  ["brand-kit", "Brand kit", "/brand-kit"],
  ["accounts", "Accounts", "/accounts"],
] as const;

function activeOf(pathname: string) {
  return pathname.split("/")[2] ?? "calendar";
}

export function useSocialAccounts(platform: SocialPlatform) {
  const accounts = useAutopostAccounts(platform);
  const list = accounts.data?.data ?? [];
  return {
    loading: accounts.isPending,
    connected: list.length > 0,
    accounts: list,
    color: (id: string) => {
      const i = list.findIndex((a) => a.id === id);
      return APP_COLORS[(i < 0 ? 0 : i) % APP_COLORS.length]!;
    },
    label: (id: string) => {
      const a = list.find((x) => x.id === id);
      return a ? (a.username ? `@${a.username}` : a.name) : "";
    },
  };
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
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
      {n > 99 ? "99+" : n}
    </span>
  );
}

function makeNav(platform: SocialPlatform) {
  const base = PLATFORMS[platform].base;
  return function NavLinks({ mobile }: { mobile?: boolean }) {
    const pathname = usePathname();
    const active = activeOf(pathname);
    const { connected, loading, accounts } = useSocialAccounts(platform);
    const pending = accounts.reduce((n, a) => n + a.pendingPosts, 0);
    const replies = accounts.reduce((n, a) => n + a.waitingReplies, 0);
    return (
      <>
        {NAV.map(([id, label, path]) => {
          const off = !loading && !connected && id !== "accounts" && id !== "brand-kit";
          return (
            <Link
              key={id}
              href={off ? `${base}/accounts` : `${base}${path}`}
              aria-current={active === id ? "page" : undefined}
              className={cx("rp-nav", active === id && "rp-nav-on")}
              style={mobile ? { flexShrink: 0, gap: 6 } : undefined}
            >
              <span>{label}</span>
              {id === "calendar" ? <Badge n={pending} /> : null}
              {id === "comments" ? <Badge n={replies} /> : null}
            </Link>
          );
        })}
      </>
    );
  };
}

function makeFooter(platform: SocialPlatform) {
  const other = platform === "instagram" ? PLATFORMS.facebook : PLATFORMS.instagram;
  return function Footer() {
    const me = useMe();
    const { accounts } = useSocialAccounts(platform);
    const broken = accounts.filter((a) => a.status === "error").length;
    return (
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        <Link href={other.base} className="rp-nav rp-nav-small">
          {other.product}
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
          <span style={{ fontSize: 11.5, color: broken ? "#B42318" : "#6C6962" }}>
            {broken
              ? `${broken} account${broken === 1 ? "" : "s"} need${broken === 1 ? "s" : ""} reconnecting`
              : accounts.length
                ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} connected`
                : "Not connected"}
          </span>
        </div>
      </div>
    );
  };
}

const SHELLS = {
  instagram: { Nav: makeNav("instagram"), Footer: makeFooter("instagram") },
  facebook: { Nav: makeNav("facebook"), Footer: makeFooter("facebook") },
};

export function AutopostShell({
  platform,
  children,
  fontClass,
}: {
  platform: SocialPlatform;
  children: ReactNode;
  fontClass: string;
}) {
  const { Nav, Footer } = SHELLS[platform];
  return (
    <ProductShell
      fontClass={fontClass}
      product={PLATFORMS[platform].product}
      Nav={Nav}
      Footer={Footer}
    >
      {children}
    </ProductShell>
  );
}
