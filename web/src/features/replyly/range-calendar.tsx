"use client";

import { useState } from "react";

import { cx } from "./ui";

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parse = (value: string) => new Date(`${value}T00:00:00`);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: count },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
    ),
  ];
}

export const fmtDay = (value: string) =>
  parse(value).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

function presets(today: Date) {
  const t = isoDay(today);
  const back = (n: number) =>
    isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
  return [
    ["Last 7 days", back(6), t],
    ["Last 14 days", back(13), t],
    ["Last 30 days", back(29), t],
    ["This month", isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), t],
    [
      "Last month",
      isoDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      isoDay(new Date(today.getFullYear(), today.getMonth(), 0)),
    ],
    [
      "Last 3 months",
      isoDay(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())),
      t,
    ],
    ["This year", isoDay(new Date(today.getFullYear(), 0, 1)), t],
    [
      "Last year",
      isoDay(new Date(today.getFullYear() - 1, 0, 1)),
      isoDay(new Date(today.getFullYear() - 1, 11, 31)),
    ],
  ] as const;
}

export function RangeCalendar({
  initialFrom,
  initialTo,
  onApply,
  onCancel,
}: {
  initialFrom: string | null;
  initialTo: string | null;
  onApply: (from: string, to: string) => void;
  onCancel: () => void;
}) {
  const [today] = useState(() => new Date());
  const todayIso = isoDay(today);
  const [from, setFrom] = useState<string | null>(
    () =>
      initialFrom ?? isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
  );
  const [to, setTo] = useState<string | null>(() => initialTo ?? todayIso);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState(() => addMonths(parse(initialTo ?? todayIso), -1));
  const picking = Boolean(from && !to);
  const end = to ?? (picking && hover && from && hover >= from ? hover : null);
  const list = presets(today);
  const active = list.find(([, f, t]) => f === from && t === to)?.[0];
  const canNext = addMonths(month, 2) <= new Date(today.getFullYear(), today.getMonth(), 1);

  function pick(day: string) {
    if (!from || to) {
      setFrom(day);
      setTo(null);
    } else if (day < from) {
      setFrom(day);
    } else setTo(day);
  }

  function jump(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setMonth(addMonths(parse(t), -1));
  }

  return (
    <div className="rp-cal">
      <div className="rp-cal-presets" role="list" aria-label="Quick ranges">
        {list.map(([label, f, t]) => (
          <button
            key={label}
            type="button"
            role="listitem"
            className={cx("rp-cal-preset", active === label && "rp-cal-preset-on")}
            onClick={() => jump(f, t)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        <div className="rp-cal-months">
          {[month, addMonths(month, 1)].map((m, mi) => (
            <div key={mi} className="rp-cal-month">
              <div className="rp-cal-head">
                {mi === 0 ? (
                  <button
                    type="button"
                    className="rp-cal-nav"
                    aria-label="Previous month"
                    onClick={() => setMonth(addMonths(month, -1))}
                  >
                    ‹
                  </button>
                ) : (
                  <span className="rp-cal-nav-gap" />
                )}
                <span className="rp-cal-title">
                  {m.toLocaleDateString("en", { month: "long", year: "numeric" })}
                </span>
                {mi === 1 ? (
                  <button
                    type="button"
                    className="rp-cal-nav"
                    aria-label="Next month"
                    disabled={!canNext}
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    ›
                  </button>
                ) : (
                  <span className="rp-cal-nav-gap" />
                )}
              </div>
              <div className="rp-cal-grid" role="grid" onMouseLeave={() => setHover(null)}>
                {WEEK.map((w) => (
                  <span key={w} className="rp-cal-dow" role="columnheader">
                    {w}
                  </span>
                ))}
                {monthDays(m).map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const v = isoDay(d);
                  const future = v > todayIso;
                  const isStart = v === from;
                  const isEnd = v === end;
                  const inside = Boolean(from && end && v > from && v < end);
                  return (
                    <button
                      key={v}
                      type="button"
                      role="gridcell"
                      aria-selected={isStart || isEnd || inside}
                      aria-label={d.toLocaleDateString("en", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      disabled={future}
                      onClick={() => pick(v)}
                      onMouseEnter={() => setHover(v)}
                      className={cx(
                        "rp-cal-day",
                        inside && "rp-cal-in",
                        (isStart || isEnd) && "rp-cal-edge",
                        isStart && end && end !== from && "rp-cal-start",
                        isEnd && from && end !== from && "rp-cal-end",
                        v === todayIso && "rp-cal-today",
                      )}
                    >
                      <span>{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="rp-cal-foot">
          <span className="rp-mono" style={{ fontSize: 12, color: "#55534E" }}>
            {from ? fmtDay(from) : "Start date"}
            <span style={{ color: "#C9C5BC", margin: "0 8px" }}>→</span>
            {to ? fmtDay(to) : picking ? "pick an end date" : "End date"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "6px 12px" }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "6px 14px" }}
              disabled={!from || !to}
              onClick={() => from && to && onApply(from, to)}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
