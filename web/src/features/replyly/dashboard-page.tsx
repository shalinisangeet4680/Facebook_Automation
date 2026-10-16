"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type AnalyticsRange,
  useMe,
  usePlayAnalytics,
  usePlayApps,
  usePlayInbox,
} from "@/lib/api/queries";
import type { PlayApp, PlayInboxReview } from "@/lib/api/types";

import { AppTile } from "./app-tile";
import { RatingMix, TrendChart } from "./charts";
import { RangePicker, rangeSuffix, rangeTitle } from "./range-picker";
import { useAppColors, useConnected } from "./shell";
import { Select } from "./select";
import { StateArt } from "./state-art";
import { A, ago, minutesLabel, rowBorder, stars } from "./tokens";
import { Banner, PageHead, Skel } from "./ui";

const BAD = "#B42318";
const MUTED = "#6C6962";

const noop = () => () => undefined;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Stat({
  label,
  value,
  delta,
  fg,
  first,
}: {
  label: string;
  value: string;
  delta?: string;
  fg?: string;
  first?: boolean;
}) {
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
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="rp-mono" style={{ fontSize: 24, letterSpacing: "-.02em" }}>
          {value}
        </span>
        {delta ? (
          <span className="rp-mono" style={{ fontSize: 12, color: fg ?? MUTED }}>
            {delta}
          </span>
        ) : null}
      </span>
    </div>
  );
}

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");

function alertsFor(app: PlayApp) {
  const out: { text: string; tone: string }[] = [];
  if (app.mode === "needs_access") out.push({ text: "Needs reply permission", tone: BAD });
  else if (app.syncErrorKind === "disconnected") out.push({ text: "Connection lost", tone: BAD });
  else if (app.syncErrorKind) out.push({ text: "Sync failed", tone: BAD });
  if (app.pauseReason) out.push({ text: "Safety pause", tone: "#8A5A00" });
  if (app.failed) out.push({ text: `${app.failed} failed to post`, tone: BAD });
  return out;
}

export function DashboardPage() {
  const router = useRouter();
  const hello = useSyncExternalStore(noop, greeting, () => "Hello");
  const { connected, loading } = useConnected();
  const me = useMe();
  const apps = usePlayApps();
  const [picked, setPicked] = useState("all");
  const [range, setRange] = useState<AnalyticsRange>({ kind: "days", days: 7 });
  const suffix = rangeSuffix(range);
  const scope = picked === "all" ? undefined : picked;
  const week = usePlayAnalytics(range, scope);
  const pending = usePlayInbox("pending", scope);
  const { color } = useAppColors();

  useEffect(() => {
    if (!loading && !connected) router.replace("/reviews/connect");
  }, [loading, connected, router]);

  const all = apps.data?.data ?? [];
  const list = scope ? all.filter((a) => a.id === scope) : all;
  const scoped = list[0];
  const waiting = pending.data?.counts.pending ?? 0;
  const ready = pending.data?.approvable.length ?? 0;
  const w = week.data;
  const rate =
    w && w.current.replyRate !== null && w.previous.replyRate !== null
      ? w.current.replyRate - w.previous.replyRate
      : null;
  const rating =
    w && w.current.rating !== null && w.previous.rating !== null
      ? Math.round((w.current.rating - w.previous.rating) * 100) / 100
      : null;
  const needs = list
    .filter((a) => a.needsReply > 0 || alertsFor(a).length)
    .sort((a, b) => alertsFor(b).length - alertsFor(a).length || b.needsReply - a.needsReply);
  const latest = (pending.data?.data ?? []).slice(0, 5);
  const topicMax = Math.max(1, ...(w?.topics ?? []).map((t) => t.count));
  const name = me.data?.user.name ?? "";

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title={
          <>
            {hello}
            {name ? `, ${name.split(" ")[0]}` : ""}.
          </>
        }
        sub={
          pending.isPending
            ? "Loading…"
            : waiting
              ? `${waiting.toLocaleString()} review${waiting === 1 ? "" : "s"} need${waiting === 1 ? "s" : ""} a reply ${scope && scoped ? `on ${scoped.title}` : `across ${list.length} app${list.length === 1 ? "" : "s"}`}${ready ? ` · ${ready} draft${ready === 1 ? "" : "s"} ready to approve` : ""}.`
              : "Every review has a reply. Auto-mode apps keep answering while you’re away."
        }
        actions={
          <>
            <Select
              label="App"
              value={picked}
              onChange={setPicked}
              minWidth={180}
              options={[
                { value: "all", label: "All apps", dot: "#191917" },
                ...all
                  .filter((a) => a.mode !== "needs_access")
                  .map((a) => ({ value: a.id, label: a.title, dot: color(a.id) })),
              ]}
            />
            <RangePicker value={range} onChange={setRange} />
          </>
        }
      />
      {apps.error ? <Banner tone="error">{errorMessage(apps.error)}</Banner> : null}

      <div
        className="rp-card"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}
      >
        <Stat
          first
          label="Needs reply"
          value={pending.isPending ? "…" : waiting.toLocaleString()}
        />
        <Stat
          label={`Replies · ${suffix}`}
          value={w ? w.repliesSent.toLocaleString() : "…"}
          delta={w ? `${w.timeSavedHours}h saved` : undefined}
        />
        <Stat
          label={`Reply rate · ${suffix}`}
          value={w?.current.replyRate === null || !w ? "—" : `${w.current.replyRate}%`}
          delta={rate === null ? undefined : `${sign(rate)}${Math.abs(rate)} pts`}
          fg={rate === null || rate === 0 ? MUTED : rate > 0 ? A : BAD}
        />
        <Stat
          label={`Avg rating · ${suffix}`}
          value={w?.current.rating === null || !w ? "—" : w.current.rating.toFixed(2)}
          delta={rating === null ? undefined : `${sign(rating)}${Math.abs(rating).toFixed(2)}`}
          fg={rating === null || rating === 0 ? MUTED : rating > 0 ? A : BAD}
        />
        <Stat
          label={`Median response · ${suffix}`}
          value={w ? minutesLabel(w.current.medianResponseMinutes) : "…"}
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
          {w ? (
            <TrendChart
              title={`Reviews vs. replies · ${rangeTitle(range)}`}
              series={w.series}
              height={200}
              rating
            />
          ) : (
            <Skel h={240} />
          )}
        </div>
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 500 }}>Needs you</span>
            <span style={{ fontSize: 12, color: MUTED }}>by app</span>
          </div>
          {apps.isPending ? (
            <Skel h={120} />
          ) : needs.length ? (
            <div style={{ display: "flex", flexDirection: "column", margin: "0 -8px" }}>
              {needs.map((a) => (
                <Link
                  key={a.id}
                  href={`/reviews/${a.id}`}
                  className="rp-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px",
                    borderRadius: 8,
                    color: "#191917",
                  }}
                >
                  <AppTile app={a} color={color(a.id)} size={28} radius={8} font={12} />
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.title}
                    </span>
                    {alertsFor(a).length ? (
                      <span style={{ fontSize: 11.5, color: alertsFor(a)[0]!.tone }}>
                        {alertsFor(a)
                          .map((x) => x.text)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  {a.needsReply ? (
                    <span
                      className="rp-mono"
                      style={{
                        minWidth: 22,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: a.needsReply > 10 ? "#FBF3E2" : "#EFEDE8",
                        color: a.needsReply > 10 ? "#8A5A00" : "#191917",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      {a.needsReply}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <div style={{ height: 150 }}>
                <StateArt kind="inbox_zero" height={150} />
              </div>
              <span style={{ fontSize: 13, color: "#55534E" }}>
                All caught up. Nothing needs you right now.
              </span>
            </div>
          )}
        </div>
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
          style={{
            gridColumn: "span 2",
            minWidth: 0,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}
          >
            <span style={{ fontWeight: 500 }}>Latest reviews waiting</span>
            <span style={{ fontSize: 12, color: MUTED }}>newest first</span>
          </div>
          {pending.isPending ? (
            <Skel h={160} />
          ) : latest.length ? (
            latest.map((r, i) => (
              <LatestRow
                key={r.id}
                r={r}
                i={i}
                appName={list.find((a) => a.id === r.appId)?.title ?? ""}
                appColor={color(r.appId)}
              />
            ))
          ) : (
            <span style={{ fontSize: 13, color: MUTED, padding: "8px 0" }}>Nothing waiting.</span>
          )}
        </div>
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <span style={{ fontWeight: 500 }}>Rating mix</span>
          {w ? <RatingMix dist={w.distribution} /> : <Skel h={120} />}
        </div>
      </div>

      <div
        className="rp-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500 }}>What reviewers talk about</span>
          <span style={{ fontSize: 12, color: MUTED }}>
            {range.kind === "all" ? "all time" : "vs the period before"}
          </span>
        </div>
        {w?.topics.length ? (
          w.topics.map((t) => (
            <div
              key={t.topic}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px,1fr) 2fr 72px",
                gap: 12,
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: t.negative ? BAD : A,
                  }}
                />
                {t.topic}
                <span className="rp-mono" style={{ fontSize: 11.5, color: MUTED }}>
                  {t.count}
                </span>
              </span>
              <div
                style={{ height: 6, borderRadius: 999, background: "#F4F2EE", overflow: "hidden" }}
              >
                <div
                  style={{
                    width: `${Math.round((t.count / topicMax) * 100)}%`,
                    height: "100%",
                    background: "#191917",
                    borderRadius: 999,
                  }}
                />
              </div>
              <span
                className="rp-mono"
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  color: t.negative && (t.change ?? 1) > 0 ? BAD : "#55534E",
                }}
              >
                {t.change === null ? "new" : `${sign(t.change)}${Math.abs(t.change)}%`}
              </span>
            </div>
          ))
        ) : (
          <span style={{ fontSize: 13, color: MUTED }}>
            {w ? "Topics appear once reviews with text come in." : "Loading…"}
          </span>
        )}
      </div>
    </div>
  );
}

function LatestRow({
  r,
  i,
  appName,
  appColor,
}: {
  r: PlayInboxReview;
  i: number;
  appName: string;
  appColor: string;
}) {
  return (
    <Link
      href={`/reviews/${r.appId}`}
      className="rp-row"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 8px",
        margin: "0 -8px",
        borderRadius: 8,
        borderTop: rowBorder(i),
        color: "#191917",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: "50%",
          background: "#F4F2EE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        {(r.authorName.trim()[0] ?? "G").toUpperCase()}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
        <span
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}
        >
          <span style={{ fontWeight: 500 }}>{r.authorName || "A Google user"}</span>
          <span style={{ color: "#C9A227", fontSize: 11.5, letterSpacing: 1 }}>
            {stars(r.stars)}
          </span>
          <span
            style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTED }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 3, background: appColor }} />
            {appName} · {ago(r.reviewedAt)}
          </span>
        </span>
        <span
          style={{
            fontSize: 13,
            color: "#33322F",
            lineHeight: 1.5,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {r.originalText || r.text || "Rating only, no text."}
        </span>
      </span>
      <span style={{ fontSize: 12, color: r.draft?.text ? A : MUTED, whiteSpace: "nowrap" }}>
        {r.draft?.text ? "Draft ready" : "No draft"}
      </span>
    </Link>
  );
}
