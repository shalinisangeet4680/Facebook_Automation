"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { Suspense, type ComponentType, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useMe,
  usePlayApps,
  usePlayConnections,
  usePlayInbox,
  useSignOut,
} from "@/lib/api/queries";

import { APP_COLORS } from "./tokens";
import { Spinner, ToastProvider, cx, useToast } from "./ui";

const NAV = [
  ["dashboard", "Dashboard", "/reviews"],
  ["apps", "Apps", "/reviews/apps"],
  ["templates", "Templates", "/reviews/templates"],
  ["releases", "Releases", "/reviews/releases"],
  ["health", "Health", "/reviews/health"],
  ["store", "Store listing", "/store"],
  ["mcp", "MCP", "/reviews/mcp"],
] as const;

function activeOf(pathname: string) {
  if (pathname === "/store" || pathname.startsWith("/store/")) return "store";
  const part = pathname.split("/")[2];
  if (!part) return "dashboard";
  if (["templates", "releases", "health", "mcp"].includes(part)) return part;
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

function Logo({ product }: { product: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "#191917",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
          <path
            d="M16 24V8.5M16 18.5l-5.5-5.5M16 15.5l5.5-5.5"
            fill="none"
            stroke="#fff"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-.01em" }}>TreeVook</span>
        <span style={{ fontSize: 11.5, color: "#6C6962" }}>{product}</span>
      </span>
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
        const off = !loading && !connected && !["mcp", "apps", "dashboard", "store"].includes(id);
        const target =
          (id === "apps" || id === "dashboard") && !loading && !connected
            ? "/reviews/connect"
            : href;
        return (
          <Link
            key={id}
            href={target}
            aria-current={active === id ? "page" : undefined}
            aria-disabled={off || undefined}
            tabIndex={off ? -1 : undefined}
            className={cx("rp-nav", active === id && "rp-nav-on", off && "rp-nav-off")}
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
    </>
  );
}

function Footer() {
  const me = useMe();
  const apps = usePlayApps();
  const { connected } = useConnected();
  const n = apps.data?.data.length ?? 0;
  return (
    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
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
        <span style={{ fontSize: 11.5, color: "#6C6962" }}>
          {connected ? `${n} app${n === 1 ? "" : "s"} · Play connected` : "Not connected"}
        </span>
      </div>
    </div>
  );
}

function useSignOutNow() {
  const router = useRouter();
  const signOut = useSignOut();
  const toast = useToast();
  return {
    pending: signOut.isPending,
    run: () =>
      signOut.mutate(undefined, {
        onSuccess: () => router.replace("/login"),
        onError: (err) => toast(errorMessage(err)),
      }),
  };
}

function AccountLinks({ mobile }: { mobile?: boolean }) {
  const signOut = useSignOutNow();
  const pathname = usePathname();
  return (
    <div style={mobile ? { display: "flex", gap: 4 } : { display: "flex", gap: 2, marginTop: -22 }}>
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        className={cx("rp-nav rp-nav-small", pathname === "/settings" && "rp-nav-on")}
        style={mobile ? { flexShrink: 0 } : { flex: 1 }}
      >
        Settings
      </Link>
      <button
        type="button"
        className="rp-nav rp-nav-small"
        style={mobile ? { flexShrink: 0 } : undefined}
        disabled={signOut.pending}
        onClick={signOut.run}
      >
        Sign out
      </button>
    </div>
  );
}

const MENU = [
  ["Templates", "/reviews/templates"],
  ["Releases", "/reviews/releases"],
  ["Health", "/reviews/health"],
  ["Store listing", "/store"],
  ["MCP", "/reviews/mcp"],
  ["Settings", "/settings"],
  ["All TreeVook products", "/home"],
] as const;

function TopMenu({ setup }: { setup: boolean }) {
  const signOut = useSignOutNow();
  if (setup)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Link href="/home" className="rp-nav rp-nav-small">
          All products
        </Link>
        <button
          type="button"
          className="rp-nav rp-nav-small"
          disabled={signOut.pending}
          onClick={signOut.run}
        >
          Sign out
        </button>
      </div>
    );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Link href="/reviews/connect" className="rp-btn-light">
        Add another app
      </Link>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger className="rp-dd" aria-label="Menu">
          <span>Menu</span>
          <span className="rp-dd-chev" aria-hidden>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2 3.5 5 6.5 8 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="rp-dd-menu"
          align="end"
          sideOffset={6}
          style={{ minWidth: 200, padding: 4 }}
        >
          {MENU.map(([label, href]) => (
            <DropdownMenu.Item key={href} asChild className="rp-dd-item">
              <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
                {label}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator style={{ height: 1, background: "#EFEDE8", margin: 4 }} />
          <DropdownMenu.Item
            className="rp-dd-item"
            disabled={signOut.pending}
            onSelect={signOut.run}
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

function BareShell({
  children,
  fontClass,
  setup,
  ready,
}: {
  children: ReactNode;
  fontClass: string;
  setup: boolean;
  ready: boolean;
}) {
  return (
    <div className={`rp rp-bare ${fontClass}`}>
      <ToastProvider>
        <header className="rp-topbar">
          <Link
            href="/reviews"
            aria-label="Play Reviews home"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Logo product="Play Reviews" />
          </Link>
          <Suspense>
            <TopMenu setup={setup} />
          </Suspense>
        </header>
        <main className="rp-main">
          <div className="rp-wrap">
            {ready ? (
              children
            ) : (
              <div
                role="status"
                aria-label="Loading"
                style={{ display: "flex", justifyContent: "center", padding: "96px 0" }}
              >
                <Spinner size={18} dark />
              </div>
            )}
          </div>
        </main>
      </ToastProvider>
    </div>
  );
}

export function ProductShell({
  children,
  fontClass,
  product,
  Nav,
  Footer,
}: {
  children: ReactNode;
  fontClass: string;
  product: string;
  Nav: ComponentType<{ mobile?: boolean }>;
  Footer: ComponentType;
}) {
  return (
    <div className={`rp ${fontClass}`}>
      <ToastProvider>
        <aside className="rp-aside" aria-label={product}>
          <Logo product={product} />
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Suspense>
              <Nav />
            </Suspense>
          </nav>
          <Suspense>
            <Footer />
          </Suspense>
          <Suspense>
            <AccountLinks />
          </Suspense>
        </aside>
        <nav className="rp-mobile-bar" aria-label={product}>
          <span style={{ marginRight: 8 }}>
            <Logo product={product} />
          </span>
          <Suspense>
            <Nav mobile />
          </Suspense>
          <Link href="/home" className="rp-nav rp-nav-small" style={{ flexShrink: 0 }}>
            All products
          </Link>
          <Suspense>
            <AccountLinks mobile />
          </Suspense>
        </nav>
        <main className="rp-main">
          <div className="rp-wrap">{children}</div>
        </main>
      </ToastProvider>
    </div>
  );
}

export function SetupShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  return (
    <BareShell fontClass={fontClass} setup ready>
      {children}
    </BareShell>
  );
}

export function ReplylyShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  const apps = usePlayApps();
  const count = apps.data?.data.length;
  if (apps.isError || (count ?? 0) >= 2)
    return (
      <ProductShell fontClass={fontClass} product="Play Reviews" Nav={NavLinks} Footer={Footer}>
        {children}
      </ProductShell>
    );
  return (
    <BareShell fontClass={fontClass} setup={false} ready={count !== undefined}>
      {children}
    </BareShell>
  );
}
