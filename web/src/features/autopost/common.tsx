"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import type { AutopostStatus, SocialPlatform } from "@/lib/api/autopost";
import { Select } from "@/features/replyly/select";
import { Banner } from "@/features/replyly/ui";

import { PLATFORMS, STATUS_STYLE } from "./platform";
import { useSocialAccounts } from "./shell";

export const MUTED = "#6C6962";

export function useConnectedGuard(platform: SocialPlatform) {
  const router = useRouter();
  const state = useSocialAccounts(platform);
  useEffect(() => {
    if (!state.loading && !state.connected) router.replace(`${PLATFORMS[platform].base}/accounts`);
  }, [state.loading, state.connected, router, platform]);
  return state;
}

export function AccountSelect({
  platform,
  value,
  onChange,
  all,
}: {
  platform: SocialPlatform;
  value: string;
  onChange: (id: string) => void;
  all?: boolean;
}) {
  const { accounts, color, label } = useSocialAccounts(platform);
  return (
    <Select
      label="Account"
      value={value}
      onChange={onChange}
      minWidth={190}
      options={[
        ...(all ? [{ value: "all", label: "All accounts" }] : []),
        ...accounts.map((a) => ({ value: a.id, label: label(a.id), dot: color(a.id) })),
      ]}
    />
  );
}

export function Pill({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 500,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: AutopostStatus }) {
  const [bg, fg, label] = STATUS_STYLE[status];
  return (
    <Pill bg={bg} fg={fg}>
      {label}
    </Pill>
  );
}

export function AccountAlerts({ platform }: { platform: SocialPlatform }) {
  const { accounts, label } = useSocialAccounts(platform);
  const [now] = useState(() => Date.now());
  const base = PLATFORMS[platform].base;
  const broken = accounts.filter((a) => a.status === "error");
  const paused = accounts.filter(
    (a) => a.pausedUntil && Date.parse(a.pausedUntil) > now && a.status === "active",
  );
  if (!broken.length && !paused.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {broken.map((a) => (
        <Banner
          key={a.id}
          tone="error"
          title={`Reconnect ${label(a.id)}`}
          action={
            <Link href={`${base}/accounts`} className="rp-btn" style={{ padding: "7px 12px" }}>
              Reconnect
            </Link>
          }
        >
          {a.error ??
            "The sign-in stopped working. Posts and replies wait until you connect again."}
        </Banner>
      ))}
      {paused.map((a) => (
        <Banner
          key={a.id}
          tone="warn"
          title={`Safety pause on ${label(a.id)}`}
          action={
            <Link
              href={`${base}/accounts`}
              className="rp-btn-light"
              style={{ padding: "7px 12px" }}
            >
              Review
            </Link>
          }
        >
          {a.pauseReason}
        </Banner>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="rp-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="rp-label">{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, color: MUTED }}>{hint}</span> : null}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rp-card" style={{ padding: 24, color: MUTED, fontSize: 13.5, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

export function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}
