"use client";

import { Popover } from "radix-ui";
import { useState } from "react";

import { isoDay } from "@/features/replyly/range-calendar";
import { Select } from "@/features/replyly/select";
import { cx } from "@/features/replyly/ui";

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 ? "30" : "00";
  return `${h}:${m}`;
});

const timeLabel = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
};

export const toLocalIso = (day: string, time: string) =>
  new Date(`${day}T${time}:00`).toISOString();

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function split(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const mins = d.getMinutes() < 30 ? "00" : "30";
  return { day: isoDay(d), time: `${String(d.getHours()).padStart(2, "0")}:${mins}` };
}

export function DateTimePicker({
  value,
  onChange,
  label,
  min,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  label: string;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = split(value);
  const [day, setDay] = useState(current?.day ?? null);
  const [time, setTime] = useState(current?.time ?? "10:00");
  const [month, setMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [todayIso] = useState(() => isoDay(new Date()));
  const floor = min ? isoDay(new Date(min)) : todayIso;
  const lead = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="rp-input"
          aria-label={label}
          style={{
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ color: value ? "#191917" : "#6C6962" }}>
            {value ? fmtDateTime(value) : "Pick a date and time"}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
              x="3.5"
              y="5"
              width="17"
              height="15"
              rx="2.5"
              stroke="#6C6962"
              strokeWidth="1.6"
            />
            <path
              d="M3.5 9.5h17M8 3v4M16 3v4"
              stroke="#6C6962"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Content
        className="rp-pop"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, width: 280 }}>
          <div className="rp-cal-head">
            <button
              type="button"
              className="rp-cal-nav"
              aria-label="Previous month"
              disabled={isoDay(month) <= floor.slice(0, 8) + "01"}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <span className="rp-cal-title">
              {month.toLocaleDateString("en", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="rp-cal-nav"
              aria-label="Next month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="rp-cal-grid" role="grid">
            {WEEK.map((w) => (
              <span key={w} className="rp-cal-dow" role="columnheader">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
              const v = isoDay(d);
              return (
                <button
                  key={v}
                  type="button"
                  role="gridcell"
                  aria-selected={v === day}
                  disabled={v < floor}
                  onClick={() => setDay(v)}
                  className={cx(
                    "rp-cal-day",
                    v === day && "rp-cal-edge",
                    v === todayIso && "rp-cal-today",
                  )}
                >
                  <span>{d.getDate()}</span>
                </button>
              );
            })}
          </div>
          <Select
            label="Time"
            value={time}
            onChange={setTime}
            block
            align="start"
            options={TIMES.map((t) => ({ value: t, label: timeLabel(t) }))}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="rp-btn-text" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "7px 14px" }}
              disabled={!day}
              onClick={() => {
                if (!day) return;
                onChange(toLocalIso(day, time));
                setOpen(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
