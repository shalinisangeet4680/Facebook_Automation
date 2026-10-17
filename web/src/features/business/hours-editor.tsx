"use client";

import type { GbpOpeningPeriod } from "@/lib/api/business";
import { Select } from "@/features/replyly/select";
import { Toggle } from "@/features/replyly/ui";

export const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
export type Day = (typeof DAYS)[number];
export type HoursForm = Record<Day, { open: boolean; from: string; to: string }>;

const MUTED = "#6C6962";
const TIMES = [
  ...Array.from(
    { length: 48 },
    (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
  ),
  "24:00",
];
const label = (t: string) => {
  if (t === "24:00") return "Midnight";
  const [h, m] = t.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
};

export function hoursForm(periods: GbpOpeningPeriod[]): HoursForm {
  return Object.fromEntries(
    DAYS.map((d) => {
      const p = periods.find((h) => h.day === d);
      return [d, { open: Boolean(p), from: p?.open ?? "09:00", to: p?.close ?? "18:00" }];
    }),
  ) as HoursForm;
}

export function hoursPeriods(form: HoursForm): GbpOpeningPeriod[] {
  return DAYS.filter((d) => form[d].open).map((d) => ({
    day: d,
    open: form[d].from,
    close: form[d].to,
  }));
}

export function HoursEditor({
  value,
  onChange,
}: {
  value: HoursForm;
  onChange: (next: HoursForm) => void;
}) {
  const setDay = (d: Day, v: Partial<HoursForm[Day]>) =>
    onChange({ ...value, [d]: { ...value[d], ...v } });
  return (
    <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
      {DAYS.map((d, i) => {
        const h = value[d];
        return (
          <div
            key={d}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 16px",
              borderTop: i ? "1px solid #EFEDE8" : "none",
              flexWrap: "wrap",
            }}
          >
            <span style={{ width: 96, fontWeight: 500, fontSize: 13.5 }}>
              {d[0]}
              {d.slice(1).toLowerCase()}
            </span>
            <Toggle
              on={h.open}
              label={`Open on ${d.toLowerCase()}`}
              onChange={() => setDay(d, { open: !h.open })}
            />
            {h.open ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Select
                  label="Opens"
                  value={h.from}
                  onChange={(v) => setDay(d, { from: v })}
                  minWidth={120}
                  align="start"
                  options={TIMES.slice(0, 48).map((t) => ({ value: t, label: label(t) }))}
                />
                <span style={{ color: MUTED }}>to</span>
                <Select
                  label="Closes"
                  value={h.to}
                  onChange={(v) => setDay(d, { to: v })}
                  minWidth={120}
                  align="start"
                  options={TIMES.slice(1).map((t) => ({ value: t, label: label(t) }))}
                />
              </span>
            ) : (
              <span style={{ fontSize: 13, color: MUTED }}>Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
