"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { usePlayAnalytics } from "@/lib/api/queries";
import type { PlayAnalytics } from "@/lib/api/types";

import { RatingMix, TrendChart } from "./charts";
import { useAppColors } from "./shell";
import { A, minutesLabel } from "./tokens";
import { Banner, PageHead, Seg, Skel } from "./ui";

const BAD = "#B42318";
const MUTED = "#6C6962";

function pct(cur: number, prev: number) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function stats(d: PlayAnalytics) {
  const c = d.current;
  const p = d.previous;
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");
  const reviews = pct(c.reviews, p.reviews);
  const rate = c.replyRate !== null && p.replyRate !== null ? c.replyRate - p.replyRate : null;
  const median =
    c.medianResponseMinutes !== null && p.medianResponseMinutes
      ? pct(c.medianResponseMinutes, p.medianResponseMinutes)
      : null;
  const rating =
    c.rating !== null && p.rating !== null ? Math.round((c.rating - p.rating) * 100) / 100 : null;
  return [
    {
      label: "Reviews",
      value: c.reviews.toLocaleString(),
      delta: reviews === null ? "" : `${sign(reviews)}${Math.abs(reviews)}%`,
      fg: MUTED,
    },
    {
      label: "Reply rate",
      value: c.replyRate === null ? "—" : `${c.replyRate}%`,
      delta: rate === null ? "" : `${sign(rate)}${Math.abs(rate)} pts`,
      fg: rate === null || rate === 0 ? MUTED : rate > 0 ? A : BAD,
    },
    {
      label: "Median response",
      value: minutesLabel(c.medianResponseMinutes),
      delta: median === null ? "" : `${sign(median)}${Math.abs(median)}%`,
      fg: median === null || median === 0 ? MUTED : median < 0 ? A : BAD,
    },
    {
      label: "Avg rating",
      value: c.rating === null ? "—" : c.rating.toFixed(2),
      delta: rating === null ? "" : `${sign(rating)}${Math.abs(rating).toFixed(2)}`,
      fg: rating === null || rating === 0 ? MUTED : rating > 0 ? A : BAD,
    },
    { label: "Time saved", value: `${d.timeSavedHours}h`, delta: "est.", fg: MUTED },
  ];
}

export function AnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [appId, setAppId] = useState("all");
  const { apps } = useAppColors();
  const q = usePlayAnalytics(days, appId === "all" ? undefined : appId);
  const d = q.data;
  const okApps = apps.filter((a) => a.mode !== "needs_access");
  const maxTopic = Math.max(1, ...(d?.topics ?? []).map((t) => t.count));

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Analytics"
        sub="How replies are moving your ratings."
        actions={
          <>
            <select
              className="rp-select"
              aria-label="App"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
            >
              <option value="all">All apps</option>
              {okApps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <Seg
              label="Range"
              small
              mono
              value={String(days) as "7" | "30" | "90"}
              onChange={(v) => setDays(Number(v) as 7 | 30 | 90)}
              options={[
                { id: "7", label: "7d" },
                { id: "30", label: "30d" },
                { id: "90", label: "90d" },
              ]}
            />
          </>
        }
      />
      {q.error ? <Banner tone="error">{errorMessage(q.error)}</Banner> : null}
      {!d ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Skel h={86} r={14} />
          <Skel h={280} r={14} />
        </div>
      ) : (
        <>
          <div
            className="rp-card"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
              opacity: q.isPlaceholderData ? 0.6 : 1,
            }}
          >
            {stats(d).map((s, i) => (
              <div
                key={s.label}
                style={{
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderLeft: i ? "1px solid #EFEDE8" : "none",
                }}
              >
                <span style={{ fontSize: 12, color: "#6C6962" }}>{s.label}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="rp-mono" style={{ fontSize: 24, letterSpacing: "-.02em" }}>
                    {s.value}
                  </span>
                  <span className="rp-mono" style={{ fontSize: 12, color: s.fg }}>
                    {s.delta}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="rp-card" style={{ padding: 18, position: "relative" }}>
            <TrendChart title="Reviews vs. replies" series={d.series} height={200} rating />
          </div>
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
              <span style={{ fontWeight: 500 }}>Rating mix</span>
              <RatingMix dist={d.distribution} />
            </div>
            <div
              className="rp-card"
              style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 500 }}>What reviewers talk about</span>
                <span style={{ fontSize: 12, color: "#6C6962" }}>Auto-tagged</span>
              </div>
              {d.topics.length ? (
                d.topics.map((t) => (
                  <div
                    key={t.topic}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(120px,1fr) 1.2fr 52px",
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
                      <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
                        {t.count}
                      </span>
                    </span>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "#F4F2EE",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round((t.count / maxTopic) * 100)}%`,
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
                      {t.change === null
                        ? "new"
                        : `${t.change > 0 ? "+" : t.change < 0 ? "−" : "±"}${Math.abs(t.change)}%`}
                    </span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 13, color: "#6C6962" }}>
                  Topics appear once reviews with text come in.
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
