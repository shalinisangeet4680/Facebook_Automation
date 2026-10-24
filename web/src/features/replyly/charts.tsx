"use client";

import { useId, useState } from "react";

import type { PlayDistribution, PlaySeriesPoint } from "@/lib/api/types";

import { A, DIST_COLORS, linePath } from "./tokens";

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });

function Legend({ rating }: { rating?: boolean }) {
  const item = (swatch: React.ReactNode, label: string) => (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {swatch}
      {label}
    </span>
  );
  return (
    <span style={{ display: "flex", gap: 14, fontSize: 12, color: "#55534E", flexWrap: "wrap" }}>
      {item(<span style={{ width: 10, height: 2, background: "#191917" }} />, "Reviews")}
      {item(<span style={{ width: 10, height: 2, background: A }} />, "Replied")}
      {rating
        ? item(
            <span style={{ width: 10, height: 0, borderTop: "2px dashed #C9A227" }} />,
            "Avg rating",
          )
        : null}
    </span>
  );
}

export function TrendChart({
  title,
  series,
  height,
  rating,
}: {
  title: string;
  series: PlaySeriesPoint[];
  height: number;
  rating?: boolean;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height === 160 ? 160 : 200;
  const reviews = series.map((p) => p.reviews);
  const replied = series.map((p) => p.replied);
  const max = Math.max(...reviews, ...replied, 1) * 1.15;
  const a = linePath(reviews, W, H, max);
  const b = linePath(replied, W, H, max);
  const ratings = series.map((p) => p.rating);
  const firstRating = ratings.find((r) => r !== null) ?? null;
  let last = firstRating ?? 3;
  const filled = ratings.map((r) => (r === null ? last : (last = r)));
  const c =
    rating && firstRating !== null
      ? linePath(
          filled.map((v) => Math.max(0, v - 3)),
          W,
          H,
          2.2,
        )
      : "";
  const labels = [0, 1, 2, 3, 4].map((k) => series[Math.round((series.length - 1) * (k / 4))]?.day);
  const grid = [H / 4, H / 2, (3 * H) / 4];
  const point = hover === null ? null : series[hover];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 500 }} id={id}>
          {title}
        </span>
        <Legend rating={rating} />
      </div>
      <div
        style={{ position: "relative" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (series.length - 1));
          setHover(Math.max(0, Math.min(series.length - 1, i)));
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={id}
          style={{
            width: "100%",
            height: H === 160 ? 160 : 220,
            overflow: "visible",
            display: "block",
          }}
        >
          {grid.map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={W}
              y2={y}
              style={{ stroke: "#EFEDE8", vectorEffect: "non-scaling-stroke" }}
            />
          ))}
          <line
            x1="0"
            y1={H}
            x2={W}
            y2={H}
            style={{ stroke: "#E6E4DF", vectorEffect: "non-scaling-stroke" }}
          />
          {b ? (
            <path d={`${b} L${W},${H} L0,${H} Z`} style={{ fill: "rgba(15,107,74,.07)" }} />
          ) : null}
          <path
            d={a}
            style={{
              fill: "none",
              stroke: "#191917",
              strokeWidth: 1.5,
              vectorEffect: "non-scaling-stroke",
              strokeLinejoin: "round",
            }}
          />
          <path
            d={b}
            style={{
              fill: "none",
              stroke: A,
              strokeWidth: 2,
              vectorEffect: "non-scaling-stroke",
              strokeLinejoin: "round",
            }}
          />
          {c ? (
            <path
              d={c}
              style={{
                fill: "none",
                stroke: "#C9A227",
                strokeWidth: 1.5,
                strokeDasharray: "4 4",
                vectorEffect: "non-scaling-stroke",
              }}
            />
          ) : null}
          {hover !== null && series.length > 1 ? (
            <line
              x1={(hover / (series.length - 1)) * W}
              x2={(hover / (series.length - 1)) * W}
              y1="0"
              y2={H}
              style={{ stroke: "#C9C5BC", vectorEffect: "non-scaling-stroke" }}
            />
          ) : null}
        </svg>
        {point && hover !== null ? (
          <div
            role="presentation"
            style={{
              position: "absolute",
              top: 4,
              left: `${(hover / Math.max(1, series.length - 1)) * 100}%`,
              transform:
                hover > series.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
              padding: "8px 10px",
              borderRadius: 8,
              background: "#191917",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.5,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)",
            }}
          >
            <div style={{ color: "#C9C5BC" }}>{fmtDay(point.day)}</div>
            <div>{point.reviews} reviews</div>
            <div>{point.replied} replied</div>
            {rating && point.rating !== null ? <div>★ {point.rating.toFixed(2)} avg</div> : null}
          </div>
        ) : null}
      </div>
      <div
        className="rp-mono"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6C6962" }}
      >
        {labels.map((d, i) => (
          <span key={i}>{d ? fmtDay(d) : ""}</span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          whiteSpace: "nowrap",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Reviews</th>
              <th>Replied</th>
              {rating ? <th>Average rating</th> : null}
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.day}>
                <td>{p.day}</td>
                <td>{p.reviews}</td>
                <td>{p.replied}</td>
                {rating ? <td>{p.rating ?? ""}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RatingMix({ dist }: { dist: PlayDistribution[] }) {
  return (
    <>
      {dist.map((d, i) => (
        <div
          key={d.stars}
          className="rp-mono"
          title={`${d.count.toLocaleString()} reviews`}
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr 36px",
            gap: 10,
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#55534E" }}>{d.stars}★</span>
          <div style={{ height: 8, borderRadius: 999, background: "#F4F2EE", overflow: "hidden" }}>
            <div
              style={{
                width: `${d.pct}%`,
                height: "100%",
                borderRadius: 999,
                background: DIST_COLORS[i],
              }}
            />
          </div>
          <span style={{ textAlign: "right", color: "#55534E" }}>{d.pct}%</span>
        </div>
      ))}
    </>
  );
}
