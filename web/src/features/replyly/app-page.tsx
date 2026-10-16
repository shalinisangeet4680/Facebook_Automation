"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useImportReport,
  usePlayApp,
  usePlayInsights,
  useRecheckPlayApp,
  useResumePlayApp,
} from "@/lib/api/queries";
import type { PlayAppDetail } from "@/lib/api/types";

import { AppTile } from "./app-tile";
import { AutomationTab } from "./automation-tab";
import { RatingMix, TrendChart } from "./charts";
import { useAppColors } from "./shell";
import { StateArt } from "./state-art";
import { minutesLabel } from "./tokens";
import { Banner, copyText, Seg, Skel, Spinner, useToast } from "./ui";

const KIND_TEXT: Record<string, string> = {
  disconnected:
    "The service account key was deleted or rotated, so syncing and auto-replies are paused. Reconnect with a new key.",
  api_disabled:
    "The Google Play Android Developer API is turned off for this Cloud project. Turn it on, then sync again.",
  quota:
    "Google’s daily quota was reached. Syncing and replies resume automatically when it resets.",
};

export function AppPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "automation" ? "auto" : "overview";
  const app = usePlayApp(id);
  const { color } = useAppColors();

  if (app.error)
    return (
      <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/reviews" className="rp-btn-quiet" style={{ alignSelf: "flex-start" }}>
          ← All apps
        </Link>
        <Banner tone="error">{errorMessage(app.error)}</Banner>
      </div>
    );

  const a = app.data;
  const noAccess = a?.mode === "needs_access";
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Link
        href="/reviews"
        className="rp-btn-quiet"
        style={{ alignSelf: "flex-start", textDecoration: "none" }}
      >
        ← All apps
      </Link>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {a ? (
            <AppTile app={a} color={color(a.id)} size={52} radius={14} font={21} />
          ) : (
            <Skel h={52} w={52} r={14} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h1 className="rp-serif" style={{ fontSize: 34, lineHeight: 1 }}>
              {a?.title ?? " "}
            </h1>
            <span className="rp-mono" style={{ fontSize: 12, color: "#6C6962" }}>
              {a?.packageName}
            </span>
          </div>
        </div>
        {a && !noAccess ? (
          <Seg
            label="App sections"
            value={tab}
            onChange={(t) =>
              router.replace(t === "auto" ? `/reviews/${id}?tab=automation` : `/reviews/${id}`, {
                scroll: false,
              })
            }
            options={[
              { id: "overview", label: "Overview" },
              { id: "auto", label: "Automation" },
            ]}
          />
        ) : null}
      </div>
      {!a ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Skel h={86} r={14} />
          <Skel h={240} r={14} />
        </div>
      ) : noAccess ? (
        <NoAccess app={a} />
      ) : (
        <>
          <AppBanners app={a} />
          {tab === "overview" ? <Overview app={a} /> : <AutomationTab app={a} />}
        </>
      )}
    </div>
  );
}

function AppBanners({ app }: { app: PlayAppDetail }) {
  const resume = useResumePlayApp(app.id);
  const toast = useToast();
  return (
    <>
      {app.pauseReason ? (
        <Banner
          tone="warn"
          title="Auto-replies are paused"
          action={
            <button
              type="button"
              className="rp-btn-light"
              disabled={resume.isPending}
              onClick={() =>
                resume.mutate(undefined, { onSuccess: () => toast("Auto-replies resumed") })
              }
            >
              Resume now
            </button>
          }
        >
          {app.pauseReason}
        </Banner>
      ) : null}
      {app.syncErrorKind && app.syncErrorKind !== "no_permission" ? (
        <Banner
          tone="error"
          title={
            app.syncErrorKind === "disconnected"
              ? "Connection lost"
              : app.syncErrorKind === "quota"
                ? "Daily quota reached"
                : "Sync failed"
          }
          action={
            app.syncErrorKind === "disconnected" ? (
              <Link href="/reviews/connect" className="rp-btn">
                Reconnect
              </Link>
            ) : undefined
          }
        >
          {KIND_TEXT[app.syncErrorKind] ?? app.syncError}
        </Banner>
      ) : null}
    </>
  );
}

function NoAccess({ app }: { app: PlayAppDetail }) {
  const recheck = useRecheckPlayApp(app.id);
  const toast = useToast();
  return (
    <div
      className="rp-card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
        gap: 28,
        alignItems: "center",
        padding: 24,
        borderRadius: 16,
      }}
    >
      <div style={{ height: 260 }}>
        <StateArt kind="no_permission" height={260} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="rp-mono" style={{ fontSize: 11.5, color: "#B42318" }}>
          403 · PERMISSION_DENIED
        </span>
        <h2 className="rp-serif" style={{ fontSize: 30, lineHeight: 1.1 }}>
          Replyly can see this app, but can’t reply yet.
        </h2>
        <p style={{ color: "#55534E", lineHeight: 1.55, textWrap: "pretty" }}>
          In Play Console → Users and permissions, open the service account and tick{" "}
          <b style={{ fontWeight: 600, color: "#191917" }}>Reply to reviews</b> for {app.title}.
          Changes usually apply within a few minutes.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "9px 14px" }}
            disabled={recheck.isPending}
            onClick={() =>
              recheck.mutate(undefined, {
                onSuccess: (next) =>
                  toast(
                    next.mode === "needs_access"
                      ? "Still no reply permission. Changes can take a few minutes."
                      : "Access is back. Reviews are syncing.",
                  ),
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {recheck.isPending ? <Spinner /> : null}
            <span>{recheck.isPending ? "Checking…" : "Check again"}</span>
          </button>
          {app.connectionEmail ? (
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "9px 14px" }}
              onClick={() =>
                void copyText(app.connectionEmail!).then(() =>
                  toast("Service account email copied"),
                )
              }
            >
              Copy service account email
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderLeft: first ? "none" : "1px solid #EFEDE8",
      }}
    >
      <span style={{ fontSize: 12, color: "#6C6962" }}>{label}</span>
      <span className="rp-mono" style={{ fontSize: 24, letterSpacing: "-.02em" }}>
        {value}
      </span>
    </div>
  );
}

function Overview({ app }: { app: PlayAppDetail }) {
  const o = app.overview;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        className="rp-card"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}
      >
        <Stat first label="Reviews · 30d" value={o.reviews.toLocaleString()} />
        <Stat label="Reply rate" value={o.replyRate === null ? "—" : `${o.replyRate}%`} />
        <Stat label="Median response" value={minutesLabel(o.medianResponseMinutes)} />
        <Stat
          label="Rating"
          value={app.overallRating === null ? "—" : `★ ${app.overallRating.toFixed(1)}`}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 20,
        }}
      >
        <div
          className="rp-card rp-span2"
          style={{ gridColumn: "span 2", minWidth: 0, padding: 18, position: "relative" }}
        >
          <TrendChart title="Reviews vs. replies · 30 days" series={o.series} height={160} />
        </div>
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <span style={{ fontWeight: 500 }}>Rating mix</span>
          <RatingMix dist={o.distribution} />
          <Link
            href={`/reviews/inbox?app=${app.id}`}
            className="rp-btn-light"
            style={{ marginTop: "auto" }}
          >
            Open inbox for this app
          </Link>
        </div>
      </div>
      <History app={app} />
    </div>
  );
}

function History({ app }: { app: PlayAppDetail }) {
  const insights = usePlayInsights(app.id, 90);
  const upload = useImportReport(app.id);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const versions = insights.data?.versions.slice(0, 6) ?? [];
  const languages = insights.data?.languages.slice(0, 6) ?? [];
  const total = languages.reduce((n, l) => n + l.reviews, 0) || 1;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
        gap: 20,
      }}
    >
      <div
        className="rp-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontWeight: 500 }}>Rating by version</span>
          <span style={{ fontSize: 12, color: "#6C6962" }}>90 days</span>
        </div>
        {versions.length ? (
          versions.map((v) => (
            <div
              key={v.version}
              className="rp-mono"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 64px 52px",
                gap: 10,
                fontSize: 12,
                alignItems: "center",
              }}
            >
              <span>{v.version}</span>
              <span style={{ color: "#6C6962", textAlign: "right" }}>{v.reviews} rev</span>
              <span style={{ textAlign: "right", color: v.rating < 3.5 ? "#B42318" : "#191917" }}>
                ★ {v.rating.toFixed(1)}
              </span>
            </div>
          ))
        ) : (
          <span style={{ fontSize: 13, color: "#6C6962" }}>
            {insights.isPending ? "Loading…" : "No version data yet."}
          </span>
        )}
      </div>
      <div
        className="rp-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <span style={{ fontWeight: 500 }}>Languages</span>
        {languages.length ? (
          languages.map((l) => (
            <div
              key={l.language}
              className="rp-mono"
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 40px",
                gap: 10,
                fontSize: 12,
                alignItems: "center",
              }}
            >
              <span style={{ color: "#55534E" }}>{l.language.toUpperCase()}</span>
              <div
                style={{ height: 6, borderRadius: 999, background: "#F4F2EE", overflow: "hidden" }}
              >
                <div
                  style={{
                    width: `${Math.round((l.reviews / total) * 100)}%`,
                    height: "100%",
                    background: "#191917",
                    borderRadius: 999,
                  }}
                />
              </div>
              <span style={{ textAlign: "right", color: "#55534E" }}>
                {Math.round((l.reviews / total) * 100)}%
              </span>
            </div>
          ))
        ) : (
          <span style={{ fontSize: 13, color: "#6C6962" }}>
            {insights.isPending ? "Loading…" : "No reviews yet."}
          </span>
        )}
      </div>
      <div
        className="rp-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <span style={{ fontWeight: 500 }}>Import older reviews</span>
        <span style={{ fontSize: 12.5, color: "#6C6962", lineHeight: 1.5 }}>
          Google’s API only returns the last 7 days. For history, download the monthly reviews CSV
          from Play Console → Download reports → Reviews, and drop it here.
        </span>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            upload.mutate(f, {
              onSuccess: (r) =>
                toast(
                  `Imported ${r.imported.toLocaleString()} reviews${r.alreadyHere ? ` · ${r.alreadyHere} already here` : ""}`,
                ),
              onError: (err) => toast(errorMessage(err)),
            });
          }}
        />
        <button
          type="button"
          className="rp-btn-light"
          style={{ marginTop: "auto" }}
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? "Importing…" : "Upload reviews CSV"}
        </button>
      </div>
    </div>
  );
}
