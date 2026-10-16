"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import type { AnalyticsRange } from "@/lib/api/queries";
import {
  type GbpLocation,
  type GbpReview,
  useBusinessAnalytics,
  useBusinessDashboard,
  useBusinessInbox,
} from "@/lib/api/business";
import { RatingMix, TrendChart } from "@/features/replyly/charts";
import { RangePicker, rangeSuffix, rangeTitle } from "@/features/replyly/range-picker";
import { Select } from "@/features/replyly/select";
import { StateArt } from "@/features/replyly/state-art";
import { A, ago, minutesLabel, rowBorder, stars } from "@/features/replyly/tokens";
import { Banner, PageHead, Skel } from "@/features/replyly/ui";

import { InsightsPanel } from "./insights-panel";
import { LocationTile } from "./location-tile";
import { useGoogleConnected, useLocationColors } from "./shell";

const BAD = "#B42318";
const MUTED = "#6C6962";

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");

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

function alertsFor(l: GbpLocation) {
  const out: { text: string; tone: string }[] = [];
  if (l.syncError) out.push({ text: "Sync failed", tone: BAD });
  if (!l.verified) out.push({ text: "Not verified on Google", tone: "#8A5A00" });
  if (l.pauseReason) out.push({ text: "Safety pause", tone: "#8A5A00" });
  return out;
}

export function BusinessDashboardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const justConnected = params.get("connected");
  const { connected, loading } = useGoogleConnected();
  const { locations, color } = useLocationColors();
  const summary = useBusinessDashboard();
  const [picked, setPicked] = useState("all");
  const [range, setRange] = useState<AnalyticsRange>({ kind: "days", days: 30 });
  const scope = picked === "all" ? undefined : picked;
  const stats = useBusinessAnalytics(range, scope);
  const pending = useBusinessInbox("pending", scope);
  const suffix = rangeSuffix(range);

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  const list = scope ? locations.filter((l) => l.id === scope) : locations;
  const waiting = pending.data?.counts.pending ?? 0;
  const ready = pending.data?.approvable.length ?? 0;
  const w = stats.data;
  const rate =
    w && w.current.replyRate !== null && w.previous.replyRate !== null
      ? w.current.replyRate - w.previous.replyRate
      : null;
  const rating =
    w && w.current.rating !== null && w.previous.rating !== null
      ? Math.round((w.current.rating - w.previous.rating) * 100) / 100
      : null;
  const needs = list
    .filter((l) => l.needsReply > 0 || alertsFor(l).length)
    .sort((a, b) => alertsFor(b).length - alertsFor(a).length || b.needsReply - a.needsReply);
  const latest = (pending.data?.data ?? []).slice(0, 5);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Google Business"
        sub={
          pending.isPending
            ? "Loading…"
            : waiting
              ? `${waiting.toLocaleString()} review${waiting === 1 ? "" : "s"} need${waiting === 1 ? "s" : ""} a reply across ${list.length} location${list.length === 1 ? "" : "s"}${ready ? ` · ${ready} draft${ready === 1 ? "" : "s"} ready to approve` : ""}.`
              : "Every review has a reply. Auto-mode locations keep answering while you’re away."
        }
        actions={
          <>
            <Select
              label="Location"
              value={picked}
              onChange={setPicked}
              minWidth={200}
              options={[
                { value: "all", label: "All locations", dot: "#191917" },
                ...locations.map((l) => ({ value: l.id, label: l.title, dot: color(l.id) })),
              ]}
            />
            <RangePicker value={range} onChange={setRange} />
          </>
        }
      />
      {justConnected ? (
        <Banner tone="info" title="Google is connected">
          {Number(justConnected) > 0
            ? `${justConnected} location${justConnected === "1" ? "" : "s"} imported with their reviews. Replies wait for your approval until you turn on auto for a rating in Settings.`
            : "No new locations were found on this account."}
        </Banner>
      ) : null}
      {summary.error ? <Banner tone="error">{errorMessage(summary.error)}</Banner> : null}

      <div
        className="rp-card"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}
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
          value={!w || w.current.replyRate === null ? "—" : `${w.current.replyRate}%`}
          delta={rate === null ? undefined : `${sign(rate)}${Math.abs(rate)} pts`}
          fg={rate === null || rate === 0 ? MUTED : rate > 0 ? A : BAD}
        />
        <Stat
          label={`Avg rating · ${suffix}`}
          value={!w || w.current.rating === null ? "—" : w.current.rating.toFixed(2)}
          delta={rating === null ? undefined : `${sign(rating)}${Math.abs(rating).toFixed(2)}`}
          fg={rating === null || rating === 0 ? MUTED : rating > 0 ? A : BAD}
        />
        <Stat
          label={`Median response · ${suffix}`}
          value={w ? minutesLabel(w.current.medianResponseMinutes) : "…"}
        />
        <Stat
          label="Posts"
          value={summary.data ? String(summary.data.publishedPosts30d) : "…"}
          delta={
            summary.data?.scheduledPosts ? `${summary.data.scheduledPosts} scheduled` : "last 30d"
          }
        />
      </div>

      <InsightsPanel range={range} locationId={scope} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 20,
        }}
      >
        <div
          className="rp-card rp-span2"
          style={{ gridColumn: "span 2", minWidth: 0, padding: 18 }}
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
            <span style={{ fontSize: 12, color: MUTED }}>by location</span>
          </div>
          {loading ? (
            <Skel h={120} />
          ) : needs.length ? (
            <div style={{ display: "flex", flexDirection: "column", margin: "0 -8px" }}>
              {needs.map((l) => (
                <Link
                  key={l.id}
                  href={`/business/${l.id}`}
                  className="rp-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 8,
                    borderRadius: 8,
                    color: "#191917",
                  }}
                >
                  <LocationTile color={color(l.id)} size={28} />
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
                      {l.title}
                    </span>
                    {alertsFor(l).length ? (
                      <span style={{ fontSize: 11.5, color: alertsFor(l)[0]!.tone }}>
                        {alertsFor(l)
                          .map((x) => x.text)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  {l.needsReply ? (
                    <span
                      className="rp-mono"
                      style={{
                        minWidth: 22,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "#EFEDE8",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      {l.needsReply}
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
                name={locations.find((l) => l.id === r.locationId)?.title ?? ""}
                color={color(r.locationId)}
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
    </div>
  );
}

function LatestRow({
  r,
  i,
  name,
  color,
}: {
  r: GbpReview;
  i: number;
  name: string;
  color: string;
}) {
  return (
    <Link
      href={`/business/${r.locationId}`}
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
            <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />
            {name} · {ago(r.reviewedAt)}
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
          {r.text || "Rating only, no text."}
        </span>
      </span>
      <span style={{ fontSize: 12, color: r.draft?.text ? A : MUTED, whiteSpace: "nowrap" }}>
        {r.draft?.text ? "Draft ready" : "No draft"}
      </span>
    </Link>
  );
}
