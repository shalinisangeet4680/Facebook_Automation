"use client";

import { useEffect, useRef, useState } from "react";

interface Point {
  date: string;
  value: number;
}

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 26, left: 48 };
const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 6, 8, 10].find((s) => s * exp >= value) ?? 10;
  return step * exp;
}

export function DailyBarChart({
  data,
  label,
  format,
}: {
  data: Point[];
  label: string;
  format: (value: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, entry!.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(28, slot * 0.62));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64)));
  const active = hover === null ? null : data[hover];

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${label} per day`}
        className="block"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-[var(--subtle)] text-[11px]"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const top = y(d.value);
          const h = Math.max(0, PAD.top + plotH - top);
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.date}>
              {h > 0 ? (
                <path
                  d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                  fill="var(--accent)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              ) : null}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={-1}
              />
              {i % labelEvery === 0 ? (
                <text
                  x={PAD.left + i * slot + slot / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-[var(--subtle)] text-[11px]"
                >
                  {shortDate.format(new Date(`${d.date}T00:00:00Z`))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {active && hover !== null ? (
        <div
          className="border-border bg-surface text-foreground pointer-events-none absolute top-0 z-10 rounded-md border px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-[var(--shadow-floating)]"
          style={{
            left: Math.min(Math.max(PAD.left + hover * slot + slot / 2, 60), width - 60),
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-muted">{shortDate.format(new Date(`${active.date}T00:00:00Z`))}</p>
          <p className="font-semibold">
            {format(active.value)} {label.toLowerCase()}
          </p>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label} per day</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
