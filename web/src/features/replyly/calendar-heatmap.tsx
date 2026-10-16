"use client";

import { useState } from "react";

import { usePlayAnalytics } from "@/lib/api/queries";

import { isoDay } from "./range-calendar";
import { cx, Skel } from "./ui";

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function CalendarHeatmap({
  appId,
  selected,
  onPick,
}: {
  appId: string;
  selected: { from: string; to: string } | null;
  onPick: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [todayIso] = useState(() => isoDay(new Date()));
  const first = isoDay(month);
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const last = isoDay(lastDate) > todayIso ? todayIso : isoDay(lastDate);
  const data = usePlayAnalytics({ kind: "custom", from: first, to: last }, appId);
  const byDay = new Map((data.data?.series ?? []).map((p) => [p.day, p]));
  const max = Math.max(1, ...(data.data?.series ?? []).map((p) => p.reviews));
  const lead = (month.getDay() + 6) % 7;
  const days = Array.from({ length: lastDate.getDate() }, (_, i) =>
    isoDay(new Date(month.getFullYear(), month.getMonth(), i + 1)),
  );
  const isCurrent =
    month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const title = month.toLocaleDateString("en", { month: "long", year: "numeric" });
  const total = (data.data?.series ?? []).reduce(
    (a, p) => ({ reviews: a.reviews + p.reviews, replied: a.replied + p.replied }),
    { reviews: 0, replied: 0 },
  );

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="rp-cal-nav"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <span className="rp-cal-title" style={{ minWidth: 150, textAlign: "center" }}>
            {title}
          </span>
          <button
            type="button"
            className="rp-cal-nav"
            aria-label="Next month"
            disabled={isCurrent}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>
        <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
          {total.reviews} reviews · {total.replied} replied
        </span>
      </div>
      {data.isPending ? (
        <Skel h={260} />
      ) : (
        <div className="rp-heat" role="grid" aria-label={`Reviews per day, ${title}`}>
          {WEEK.map((w) => (
            <span key={w} className="rp-cal-dow" role="columnheader">
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {days.map((d) => {
            const p = byDay.get(d);
            const n = p?.reviews ?? 0;
            const future = d > todayIso;
            const inRange = Boolean(selected && d >= selected.from && d <= selected.to);
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                disabled={future}
                aria-selected={inRange}
                title={
                  future
                    ? undefined
                    : `${new Date(`${d}T00:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}: ${n} review${n === 1 ? "" : "s"} · ${p?.replied ?? 0} replied`
                }
                onClick={() => onPick(d)}
                className={cx(
                  "rp-heat-day",
                  !n && "rp-heat-empty",
                  inRange && "rp-heat-on",
                  d === todayIso && "rp-heat-today",
                )}
              >
                <span className="rp-heat-num">{Number(d.slice(8))}</span>
                {!future && n ? <span className="rp-heat-count">{n}</span> : null}
                {!future && p?.replied ? <span className="rp-heat-rep">↩ {p.replied}</span> : null}
                {!future && n ? (
                  <span className="rp-heat-bar" aria-hidden>
                    <span style={{ width: `${Math.max(8, Math.round((n / max) * 100))}%` }} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          justifyContent: "flex-end",
          fontSize: 11.5,
          color: "#6C6962",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="rp-heat-bar" style={{ position: "static", width: 28 }}>
            <span style={{ width: "60%" }} />
          </span>
          reviews vs. busiest day ({max})
        </span>
        <span className="rp-mono" style={{ color: "#0F6B4A" }}>
          ↩ replied
        </span>
      </div>
      <table
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        <caption>Reviews and replies per day, {title}</caption>
        <tbody>
          {(data.data?.series ?? []).map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{p.reviews} reviews</td>
              <td>{p.replied} replied</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
