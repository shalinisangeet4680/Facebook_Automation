"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { useMe } from "@/lib/api/queries";
import { useBusinessConnections, useBusinessInbox, useLocations } from "@/lib/api/business";
import { ToastProvider } from "@/features/replyly/ui";

import { LocationMenu } from "./location-menu";
import { Icon, type IconName } from "./ui";

import "./tv.css";

export const LOCATION_COLORS = ["#2563C9", "#E2562B", "#0F7A55", "#7C5CD6", "#C2410C", "#0E7490"];

type Screen =
  "home" | "reviews" | "posts" | "media" | "templates" | "locations" | "ai" | "account" | "other";

const NAV: [Screen, string, string][] = [
  ["home", "Home", "/business"],
  ["reviews", "Reviews", "/business/reviews"],
  ["posts", "Posts", "/business/posts"],
  ["media", "Media", "/business/media"],
  ["templates", "Reply templates", "/business/templates"],
  ["locations", "Locations", "/business/locations"],
  ["ai", "AI assistants", "/business/ai"],
];

const TABS: [Screen, string, string, IconName][] = [
  ["home", "Home", "/business", "home"],
  ["reviews", "Reviews", "/business/reviews", "reviews"],
  ["posts", "Posts", "/business/posts", "posts"],
  ["media", "Media", "/business/media", "photo"],
  ["templates", "Templates", "/business/templates", "templates"],
  ["locations", "Locations", "/business/locations", "locations"],
];

function screenOf(pathname: string): Screen {
  const part = pathname.split("/")[2];
  if (!part) return "home";
  if (part === "mcp") return "ai";
  if (["reviews", "posts", "media", "templates", "locations", "ai", "account"].includes(part))
    return part as Screen;
  return "other";
}

const storeListeners = new Set<() => void>();

function subscribeStore(notify: () => void) {
  storeListeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    storeListeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function readRaw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
  storeListeners.forEach((notify) => notify());
}

function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(
    subscribeStore,
    () => readRaw(key),
    () => null,
  );
  return useMemo(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
}

const NO_SEEN: Record<string, boolean> = {};

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
      return LOCATION_COLORS[(i < 0 ? 0 : i) % LOCATION_COLORS.length]!;
    },
  };
}

type TvState = {
  loc: string;
  setLoc: (id: string) => void;
  locationId: string | undefined;
  seen: Record<string, boolean>;
  markSeen: (key: string) => void;
};

const TvContext = createContext<TvState>({
  loc: "all",
  setLoc: () => undefined,
  locationId: undefined,
  seen: {},
  markSeen: () => undefined,
});

export const useTv = () => useContext(TvContext);

export function useLocationFilter() {
  const { loc, setLoc, locationId } = useTv();
  return { loc, setLoc, locationId };
}

export function useSetup() {
  const { connected } = useGoogleConnected();
  const locations = useLocations();
  const replied = useBusinessInbox("replied").data?.counts.replied ?? 0;
  const { seen } = useTv();
  const has = connected && (locations.data?.data.length ?? 0) > 0;
  const steps = [
    { label: "Connect Google", done: connected, cta: "Connect", href: "/business/connect" },
    { label: "Pick locations", done: has, cta: "Pick", href: "/business/locations" },
    { label: "Choose reply mode", done: has, cta: "Choose", href: "/business/locations" },
    { label: "Send your first reply", done: replied > 0, cta: "Reply", href: "/business/reviews" },
    {
      label: "Check reply templates",
      done: Boolean(seen["setup:templates"]),
      cta: "Open",
      href: "/business/templates",
    },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, next: steps.find((s) => !s.done) ?? null, complete: done === steps.length };
}

function TvProvider({ children }: { children: ReactNode }) {
  const loc = useStored("tv.loc", "all");
  const seen = useStored("tv.seen", NO_SEEN);
  const locations = useLocations();
  const ids = locations.data?.data.map((l) => l.id);
  const valid = loc === "all" || !ids || ids.includes(loc);
  const setLoc = useCallback((id: string) => writeStore("tv.loc", id), []);
  const markSeen = useCallback(
    (key: string) => {
      if (!seen[key]) writeStore("tv.seen", { ...seen, [key]: true });
    },
    [seen],
  );
  const value = useMemo(
    () => ({
      loc: valid ? loc : "all",
      setLoc,
      locationId: valid && loc !== "all" ? loc : undefined,
      seen,
      markSeen,
    }),
    [loc, valid, setLoc, seen, markSeen],
  );
  return <TvContext.Provider value={value}>{children}</TvContext.Provider>;
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MB"
  );
}

function Sidebar({ screen }: { screen: Screen }) {
  const { connected, loading } = useGoogleConnected();
  const waiting = useBusinessInbox("pending").data?.counts.pending ?? 0;
  const setup = useSetup();
  const me = useMe();
  const name = me.data?.workspace.name ?? "My business";
  const email = me.data?.user.email ?? me.data?.user.phone ?? "";
  const href = (h: string) => (!loading && !connected ? "/business/connect" : h);
  return (
    <aside className="gb-side" aria-label="Google Business">
      <LocationMenu />
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(([id, label, h]) => (
          <Link
            key={id}
            href={href(h)}
            className="gb-nav"
            aria-current={screen === id ? "page" : undefined}
          >
            <span className="gb-nav-label">{label}</span>
            {id === "reviews" && connected && waiting > 0 ? (
              <span className="gb-badge">{waiting > 99 ? "99+" : waiting}</span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div style={{ flex: 1, minHeight: 16 }} />
      {connected && !setup.complete ? (
        <Link href="/business" className="gb-side-setup">
          <span className="gb-side-setup-head">
            <span>Getting started</span>
            <span className="gb-side-faint">
              {setup.done}/{setup.steps.length}
            </span>
          </span>
          <span className="gb-side-setup-bar">
            {setup.steps.map((s) => (
              <span key={s.label} data-done={s.done} />
            ))}
          </span>
        </Link>
      ) : null}
      <Link
        href="/business/account"
        className="gb-nav"
        aria-current={screen === "account" ? "page" : undefined}
      >
        <span className="gb-nav-label">Google account</span>
      </Link>
      <Link href="/home" className="gb-nav">
        <span className="gb-nav-label">All TreeVook products</span>
      </Link>
      <Link href="/settings" className="gb-side-me">
        <span className="gb-side-avatar">{initialsOf(name)}</span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span className="gb-side-name">{name}</span>
          <span className="gb-side-faint gb-side-email">{email}</span>
        </span>
      </Link>
    </aside>
  );
}

function Header() {
  const me = useMe();
  const name = me.data?.workspace.name ?? "My business";
  return (
    <header className="gb-head gb-mobile-only">
      <LocationMenu compact />
      <Link
        href="/business/account"
        aria-label="Google account"
        style={{
          marginLeft: "auto",
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 16,
          background: "var(--gb-green-soft)",
          color: "var(--gb-green)",
          fontSize: 11,
          fontWeight: 600,
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {initialsOf(name)}
      </Link>
    </header>
  );
}

function TabBar({ screen }: { screen: Screen }) {
  const { connected } = useGoogleConnected();
  const waiting = useBusinessInbox("pending").data?.counts.pending ?? 0;
  return (
    <nav className="gb-tabbar" aria-label="Google Business">
      {TABS.map(([id, label, href, icon]) => (
        <Link
          key={id}
          href={connected ? href : "/business/connect"}
          className="gb-tab"
          aria-current={screen === id ? "page" : undefined}
        >
          <Icon name={icon} size={22} stroke={1.5} />
          {label}
          {id === "reviews" && connected && waiting > 0 ? (
            <span className="gb-tab-badge">{waiting > 99 ? "99+" : waiting}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const screen = screenOf(pathname);
  const { connected, loading } = useGoogleConnected();
  const bare = pathname === "/business/connect" && !loading && !connected;
  if (bare) return <>{children}</>;
  return (
    <div className="gb-app">
      <Sidebar screen={screen} />
      <div className="gb-body">
        <Header />
        <main className="gb-main">
          <div className="gb-wrap">{children}</div>
        </main>
      </div>
      <TabBar screen={screen} />
    </div>
  );
}

export function BusinessShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  return (
    <div className={`rp gb ${fontClass}`}>
      <ToastProvider>
        <TvProvider>
          <Suspense>
            <Chrome>{children}</Chrome>
          </Suspense>
        </TvProvider>
      </ToastProvider>
    </div>
  );
}
