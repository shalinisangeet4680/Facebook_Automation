"use client";

import { useState } from "react";

import type { AnalyticsRange } from "@/lib/api/queries";
import { type GbpInsights, type GbpMetrics, useBusinessInsights } from "@/lib/api/business";
import { rangeTitle } from "@/features/replyly/range-picker";
import { A } from "@/features/replyly/tokens";
import { cx, Skel } from "@/features/replyly/ui";

type Key = "views" | keyof GbpMetrics;

const TILES: { key: Key; label: string }[] = [
  { key: "views", label: "Profile views" },
  { key: "calls", label: "Calls" },
  { key: "websiteClicks", label: "Website clicks" },
  { key: "directions", label: "Directions" },
  { key: "conversations", label: "Messages" },
  { key: "bookings", label: "Bookings" },
];

const valueOf = (m: GbpMetrics, key: Key) =>
  key === "views" ? m.impressionsMaps + m.impressionsSearch : m[key];

const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString());

function change(now: number, before: number) {
  if (!before) return now ? "new" : "±0%";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`;
}

function Bars({ data, metric }: { data: GbpInsights["series"]; metric: Key }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map((d) => valueOf(d, metric));
  const max = Math.max(1, ...values);
  const W = 600;
  const H = 180;
  const gap = data.length > 60 ? 1 : 3;
  const bw = Math.max(1, W / data.length - gap);
  const fmtDay = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });
  const tip = hover === null ? null : data[hover];
  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}
        role="img"
        aria-label="Daily values"
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#EFEDE8" strokeWidth={1} />
        ))}
        {values.map((v, i) => {
          const h = Math.max(v ? 2 : 0, (v / max) * (H - 8));
          return (
            <rect
              key={data[i]!.day}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={h}
              rx={Math.min(3, bw / 2)}
              fill={hover === i ? "#191917" : A}
              opacity={hover === null || hover === i ? 1 : 0.55}
              onMouseEnter={() => setHover(i)}
            />
          );
        })}
      </svg>
      {tip ? (
        <div
          className="rp-mono"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "#191917",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 11.5,
            pointerEvents: "none",
          }}
        >
          {fmtDay(tip.day)} · {fmt(valueOf(tip, metric))}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "#6C6962",
          marginTop: 6,
        }}
      >
        <span>{data[0] ? fmtDay(data[0].day) : ""}</span>
        <span>{data.at(-1) ? fmtDay(data.at(-1)!.day) : ""}</span>
      </div>
    </div>
  );
}

export function InsightsPanel({
  range,
  locationId,
  compact,
}: {
  range: AnalyticsRange;
  locationId?: string;
  compact?: boolean;
}) {
  const insights = useBusinessInsights(range, locationId);
  const [metric, setMetric] = useState<Key>("views");
  const d = insights.data;
  const tiles = compact ? TILES.slice(0, 4) : TILES;
  return (
    <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit,minmax(${compact ? 130 : 140}px,1fr))`,
        }}
      >
        {tiles.map((t, i) => {
          const now = d ? valueOf(d.current, t.key) : 0;
          const before = d ? valueOf(d.previous, t.key) : 0;
          const up = now >= before;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={metric === t.key}
              onClick={() => setMetric(t.key)}
              className={cx("rp-row")}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                border: "none",
                borderLeft: i ? "1px solid #EFEDE8" : "none",
                borderBottom: `2px solid ${metric === t.key ? "#191917" : "transparent"}`,
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 12, color: "#6C6962" }}>{t.label}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span
                  className="rp-mono"
                  style={{ fontSize: 22, letterSpacing: "-.02em", color: "#191917" }}
                >
                  {d ? fmt(now) : "…"}
                </span>
                {d && range.kind !== "all" ? (
                  <span
                    className="rp-mono"
                    style={{ fontSize: 12, color: now === before ? "#6C6962" : up ? A : "#B42318" }}
                  >
                    {change(now, before)}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div
        style={{
          padding: 18,
          borderTop: "1px solid #EFEDE8",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500 }}>
            {TILES.find((t) => t.key === metric)?.label} · {rangeTitle(range)}
          </span>
          <span style={{ fontSize: 12, color: "#6C6962" }}>{d?.note}</span>
        </div>
        {d ? <Bars data={d.series} metric={metric} /> : <Skel h={200} />}
      </div>
    </div>
  );
}
