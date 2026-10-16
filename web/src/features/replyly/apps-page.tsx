"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { keys, syncPlayApp, usePlayApps, useUpdatePlayApp } from "@/lib/api/queries";
import type { PlayApp } from "@/lib/api/types";

import { useConnected } from "./shell";
import { A, appColor, linePath, MODE_LABEL, MODE_STYLE, rowBorder } from "./tokens";
import { AppTile } from "./app-tile";
import { Banner, PageHead, Skel, Toggle, useToast } from "./ui";

const COLS = "minmax(200px,2.2fr) 1fr 1fr 1.1fr 1fr 60px";

export function AppsPage() {
  const router = useRouter();
  const toast = useToast();
  const client = useQueryClient();
  const { connected, loading } = useConnected();
  const apps = usePlayApps();
  const [sync, setSync] = useState<{ pct: number; reviews: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !connected) router.replace("/reviews/connect");
  }, [loading, connected, router]);

  const list = apps.data?.data ?? [];
  const ok = list.filter((a) => a.mode !== "needs_access");
  const blocked = list.length - ok.length;
  const awaiting = ok.reduce((n, a) => n + a.needsReply, 0);

  async function syncAll() {
    if (sync || !list.length) return;
    setSyncError(null);
    setSync({ pct: 8, reviews: 0 });
    let reviews = 0;
    let failed = 0;
    for (const [i, app] of list.entries()) {
      try {
        reviews += (await syncPlayApp(app.id)).fetched;
      } catch (err) {
        failed++;
        setSyncError(`${app.title}: ${errorMessage(err)}`);
      }
      setSync({ pct: Math.max(8, Math.round(((i + 1) / list.length) * 100)), reviews });
    }
    await client.invalidateQueries({ queryKey: keys.play });
    setTimeout(() => setSync(null), 600);
    toast(
      failed
        ? `Synced with ${failed} error${failed === 1 ? "" : "s"}`
        : `Synced ${reviews.toLocaleString()} reviews`,
    );
  }

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Apps"
        sub={
          apps.isPending
            ? "Loading…"
            : `${ok.length} connected · ${awaiting.toLocaleString()} review${awaiting === 1 ? "" : "s"} awaiting a reply${blocked ? ` · ${blocked} need${blocked === 1 ? "s" : ""} access` : ""}`
        }
        actions={
          <>
            <button
              type="button"
              className="rp-btn-light"
              onClick={() => void syncAll()}
              disabled={Boolean(sync)}
            >
              Sync now
            </button>
            <Link href="/reviews/connect" className="rp-btn">
              Add app
            </Link>
          </>
        }
      />
      {sync ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 16px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #E6E4DF",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
            Syncing reviews
          </span>
          <div
            style={{
              flex: 1,
              height: 5,
              borderRadius: 999,
              background: "#EFEDE8",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${sync.pct}%`,
                height: "100%",
                backgroundImage: "repeating-linear-gradient(45deg,#0F6B4A 0 7px,#2B8A66 7px 14px)",
                backgroundSize: "28px 100%",
                animation: "rp-stripes .8s linear infinite",
                transition: "width .5s",
              }}
            />
          </div>
          <span
            className="rp-mono"
            style={{ fontSize: 11.5, color: "#6C6962", whiteSpace: "nowrap" }}
          >
            {sync.pct}% · {sync.reviews.toLocaleString()} reviews
          </span>
        </div>
      ) : null}
      {syncError ? <Banner tone="error">{syncError}</Banner> : null}
      {apps.error ? <Banner tone="error">{errorMessage(apps.error)}</Banner> : null}
      <div className="rp-card" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 720 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid #EFEDE8",
              fontSize: 11.5,
              color: "#6C6962",
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            <span>App</span>
            <span>Rating</span>
            <span>Awaiting</span>
            <span>Mode</span>
            <span>Replies · 14d</span>
            <span style={{ textAlign: "right" }}>Auto</span>
          </div>
          {apps.isPending
            ? [0, 1, 2].map((i) => (
                <div key={i} style={{ padding: "18px", borderTop: rowBorder(i) }}>
                  <Skel h={18} />
                </div>
              ))
            : list.map((a, i) => <AppRow key={a.id} app={a} index={i} />)}
          {!apps.isPending && !list.length ? (
            <div
              style={{ padding: "28px 18px", color: "#55534E", fontSize: 13.5, lineHeight: 1.55 }}
            >
              This service account can’t see any apps yet. In Play Console, give it access to your
              apps — new apps show up here within a day — or{" "}
              <Link href="/reviews/connect">add one by package name</Link>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AppRow({ app, index }: { app: PlayApp; index: number }) {
  const router = useRouter();
  const toast = useToast();
  const update = useUpdatePlayApp(app.id);
  const noAccess = app.mode === "needs_access";
  const mode = MODE_LABEL[app.mode];
  const [bg, fg] = MODE_STYLE[mode]!;
  const spark = app.replies14d;
  const max = Math.max(...spark, 1) * 1.1;
  const enabled = update.isPending ? !app.enabled : app.enabled;
  return (
    <div
      className="rp-row"
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/reviews/${app.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/reviews/${app.id}`);
      }}
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        gap: 12,
        alignItems: "center",
        padding: "14px 18px",
        borderTop: rowBorder(index),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <AppTile app={app} color={appColor(index)} size={36} radius={10} font={15} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontWeight: 500 }}>{app.title}</span>
          <span
            className="rp-mono"
            style={{
              fontSize: 11.5,
              color: "#6C6962",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {app.packageName}
          </span>
        </span>
      </div>
      <span className="rp-mono" style={{ fontSize: 13 }}>
        {noAccess || app.overallRating === null ? "—" : `★ ${app.overallRating.toFixed(1)}`}
      </span>
      <span
        className="rp-mono"
        style={{ fontSize: 13, color: app.needsReply > 10 ? "#8A5A00" : "#191917" }}
      >
        {noAccess ? "—" : app.needsReply.toLocaleString()}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <span
          style={{
            padding: "3px 9px",
            borderRadius: 999,
            background: bg,
            color: fg,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {mode}
        </span>
        {app.pauseReason ? (
          <span title={app.pauseReason} style={{ fontSize: 11, color: "#8A5A00" }}>
            Safety pause
          </span>
        ) : null}
      </span>
      <svg
        viewBox="0 0 80 24"
        preserveAspectRatio="none"
        style={{ width: 80, height: 24, overflow: "visible" }}
        aria-label={`${spark.reduce((a, b) => a + b, 0)} replies in 14 days`}
      >
        <path
          d={noAccess ? "M0,22 L80,22" : linePath(spark, 80, 24, max)}
          style={{
            fill: "none",
            stroke: noAccess ? "#D3D0C9" : A,
            strokeWidth: 1.5,
            vectorEffect: "non-scaling-stroke",
            strokeLinejoin: "round",
          }}
        />
      </svg>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Toggle
          on={enabled && !noAccess}
          disabled={noAccess}
          label={`Auto-reply for ${app.title}`}
          onChange={() =>
            update.mutate(
              { automation: !app.enabled },
              {
                onSuccess: () => toast(`${app.title}: auto-reply ${app.enabled ? "paused" : "on"}`),
                onError: (err) => toast(errorMessage(err)),
              },
            )
          }
        />
      </div>
    </div>
  );
}
