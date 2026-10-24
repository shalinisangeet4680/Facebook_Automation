"use client";

import { useId, useState } from "react";

import type { RatePoint } from "@/lib/api/play-releases";

const W = 600;
const H = 180;
const OVER = "#B42318";

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });

export function RateChart({
  title,
  series,
  threshold,
}: {
  title: string;
  series: RatePoint[];
  threshold: number;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const rates = series.map((p) => p.rate).filter((r): r is number => r !== null);
  const max = Math.max(threshold, ...rates) * 1.25 || 1;
  const x = (i: number) => (series.length < 2 ? W / 2 : (i / (series.length - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  let d = "";
  let open = false;
  series.forEach((p, i) => {
    if (p.rate === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(p.rate).toFixed(1)} `;
    open = true;
  });
  const latest = [...series].reverse().find((p) => p.rate !== null) ?? null;
  const point = hover === null ? null : series[hover];
  const labels = [0, 1, 2, 3].map((k) => series[Math.round((series.length - 1) * (k / 3))]?.day);
  const ty = y(threshold);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 500 }} id={id}>
          {title}
        </span>
        <span style={{ display: "flex", gap: 14, fontSize: 12, color: "#55534E" }}>
          <span>
            Latest{" "}
            <span className="rp-mono" style={{ color: "#191917", fontWeight: 500 }}>
              {latest?.rate !== undefined && latest?.rate !== null ? `${latest.rate}%` : "—"}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, borderTop: `2px dashed ${OVER}` }} />
            Limit {threshold}%
          </span>
        </span>
      </div>
      <div
        style={{ position: "relative" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          if (series.length < 1) return;
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
          style={{ width: "100%", height: 180, overflow: "visible", display: "block" }}
        >
          {[H / 4, H / 2, (3 * H) / 4].map((g) => (
            <line
              key={g}
              x1="0"
              x2={W}
              y1={g}
              y2={g}
              style={{ stroke: "#EFEDE8", vectorEffect: "non-scaling-stroke" }}
            />
          ))}
          <line
            x1="0"
            x2={W}
            y1={H}
            y2={H}
            style={{ stroke: "#E6E4DF", vectorEffect: "non-scaling-stroke" }}
          />
          <line
            x1="0"
            x2={W}
            y1={ty}
            y2={ty}
            style={{
              stroke: OVER,
              strokeWidth: 1.5,
              strokeDasharray: "5 5",
              vectorEffect: "non-scaling-stroke",
            }}
          />
          <path
            d={d}
            style={{
              fill: "none",
              stroke: "#191917",
              strokeWidth: 2,
              vectorEffect: "non-scaling-stroke",
              strokeLinejoin: "round",
            }}
          />
          {hover !== null ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1="0"
              y2={H}
              style={{ stroke: "#C9C5BC", vectorEffect: "non-scaling-stroke" }}
            />
          ) : null}
        </svg>
        {series.map((p, i) =>
          p.rate !== null && p.rate > threshold ? (
            <span
              key={p.day}
              aria-hidden
              style={{
                position: "absolute",
                left: `calc(${(x(i) / W) * 100}% - 4px)`,
                top: `calc(${(y(p.rate) / H) * 100}% - 4px)`,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: OVER,
                boxShadow: "0 0 0 2px #fff",
                pointerEvents: "none",
              }}
            />
          ) : null,
        )}
        {point && hover !== null ? (
          <div
            role="presentation"
            style={{
              position: "absolute",
              top: 4,
              left: `${(x(hover) / W) * 100}%`,
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
            <div>{point.rate === null ? "No data" : `${point.rate}%`}</div>
            <div>{point.users.toLocaleString()} users</div>
          </div>
        ) : null}
      </div>
      <div
        className="rp-mono"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6C6962" }}
      >
        {labels.map((day, i) => (
          <span key={i}>{day ? fmtDay(day) : ""}</span>
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
              <th>Rate (%)</th>
              <th>Users</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.day}>
                <td>{p.day}</td>
                <td>{p.rate ?? ""}</td>
                <td>{p.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
