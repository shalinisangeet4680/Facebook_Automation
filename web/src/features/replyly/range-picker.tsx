"use client";

import { Popover } from "radix-ui";
import { useState } from "react";

import type { AnalyticsRange } from "@/lib/api/queries";

import { RangeCalendar } from "./range-calendar";
import { cx } from "./ui";

const short = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year:
      new Date(`${value}T00:00:00`).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });

export function rangeLabel(range: AnalyticsRange) {
  if (range.kind === "today") return "today";
  if (range.kind === "days") return `${range.days}d`;
  if (range.kind === "all") return "all time";
  return range.from === range.to ? short(range.from) : `${short(range.from)} – ${short(range.to)}`;
}

export function rangeSuffix(range: AnalyticsRange) {
  if (range.kind === "today") return "today";
  if (range.kind === "days") return `${range.days}d`;
  if (range.kind === "all") return "all time";
  return range.from === range.to ? short(range.from) : "range";
}

export function rangeTitle(range: AnalyticsRange) {
  if (range.kind === "today") return "today";
  if (range.kind === "days") return `${range.days} days`;
  if (range.kind === "all") return "all time";
  return rangeLabel(range);
}

export function RangePicker({
  value,
  onChange,
  presets = [7, 30, 90],
  today,
}: {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  presets?: (7 | 30 | 90)[];
  today?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOn = (k: string) =>
    (value.kind === "days" && k === String(value.days)) || value.kind === k;

  return (
    <div className="rp-seg" role="group" aria-label="Period">
      {today ? (
        <button
          type="button"
          aria-pressed={isOn("today")}
          className={cx("rp-seg-btn", isOn("today") && "rp-seg-on")}
          style={{ padding: "5px 11px", fontSize: 12.5 }}
          onClick={() => onChange({ kind: "today" })}
        >
          Today
        </button>
      ) : null}
      {presets.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={isOn(String(d))}
          className={cx("rp-seg-btn rp-mono", isOn(String(d)) && "rp-seg-on")}
          style={{ padding: "5px 11px", fontSize: 12.5 }}
          onClick={() => onChange({ kind: "days", days: d })}
        >
          {d}d
        </button>
      ))}
      <button
        type="button"
        aria-pressed={isOn("all")}
        className={cx("rp-seg-btn", isOn("all") && "rp-seg-on")}
        style={{ padding: "5px 11px", fontSize: 12.5 }}
        onClick={() => onChange({ kind: "all" })}
      >
        All
      </button>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-pressed={isOn("custom")}
            className={cx("rp-seg-btn", isOn("custom") && "rp-seg-on")}
            style={{ padding: "5px 11px", fontSize: 12.5, alignItems: "center" }}
          >
            {value.kind === "custom" ? rangeLabel(value) : "Custom"}
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M2 3.5 5 6.5 8 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Popover.Trigger>
        <Popover.Content
          className="rp-pop"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <RangeCalendar
            initialFrom={value.kind === "custom" ? value.from : null}
            initialTo={value.kind === "custom" ? value.to : null}
            onCancel={() => setOpen(false)}
            onApply={(f, t) => {
              onChange({ kind: "custom", from: f, to: t });
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
