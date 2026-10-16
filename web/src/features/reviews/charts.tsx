"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const STAR_COLORS = [1, 2, 3, 4, 5].map((s) => `var(--chart-star-${s})`);
const AXIS = { fontSize: 11, fill: "var(--subtle)" };

function useWidth(min = 240) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(min, entry!.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [min]);
  return { ref, width };
}

const roundedTop = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

const roundedRight = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
};

export function ChartCard({
  title,
  description,
  table,
  children,
  className,
  empty,
}: {
  title: string;
  description?: string;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
  empty?: string | null;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card role="region" aria-label={title} className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {description ? <p className="text-small text-muted mt-0.5">{description}</p> : null}
        </div>
        {!empty ? (
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            aria-pressed={showTable}
            className="text-caption text-muted hover:text-foreground shrink-0 rounded-md px-2 py-1 font-medium underline-offset-4 hover:underline"
          >
            {showTable ? "Chart" : "Table"}
          </button>
        ) : null}
      </div>
      {empty ? (
        <p className="text-small text-muted bg-surface-muted grid min-h-32 place-items-center rounded-[var(--radius-control)] px-4 text-center">
          {empty}
        </p>
      ) : showTable ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted text-left">
                {table.head.map((h) => (
                  <th key={h} className="border-border border-b px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-border border-b last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className={cn("px-2 py-1.5", j > 0 && "tabular-nums")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

export function StarLegend() {
  return (
    <ul className="text-caption text-muted flex flex-wrap gap-x-3 gap-y-1" aria-label="Legend">
      {[5, 4, 3, 2, 1].map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ background: STAR_COLORS[s - 1] }}
            aria-hidden
          />
          {s}★
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  return (
    <div
      className="border-border bg-surface pointer-events-none absolute top-0 z-10 rounded-md border px-3 py-2 text-[12px] whitespace-nowrap shadow-[var(--shadow-floating)]"
      style={{ left: Math.min(Math.max(x, 70), width - 70), transform: "translateX(-50%)" }}
    >
      {children}
    </div>
  );
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((s) => s * exp >= v) ?? 10) * exp;
};

export interface StarBucket {
  label: string;
  stars: number[];
  total: number;
}

export function StarColumns({ data, height = 200 }: { data: StarBucket[]; height?: number }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 10, right: 6, bottom: 24, left: 34 };
  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(3, Math.min(24, slot * 0.64));
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const every = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
  const active = hover === null ? null : data[hover];
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Reviews by star rating over time"
        className="block"
        onMouseLeave={() => setHover(null)}
      >
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
            />
            <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" {...AXIS}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          let base = pad.top + plotH;
          const topIndex = [4, 3, 2, 1, 0].find((s) => d.stars[s]! > 0);
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.5}>
              {[0, 1, 2, 3, 4].map((s) => {
                const n = d.stars[s]!;
                if (!n) return null;
                const h = (n / max) * plotH;
                const top = base - h;
                const gap = base < pad.top + plotH ? 2 : 0;
                const segH = Math.max(1, h - gap);
                base = top;
                return s === topIndex ? (
                  <path key={s} d={roundedTop(x, top, barW, segH, 4)} fill={STAR_COLORS[s]} />
                ) : (
                  <rect key={s} x={x} y={top} width={barW} height={segH} fill={STAR_COLORS[s]} />
                );
              })}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              {i % every === 0 ? (
                <text
                  x={pad.left + i * slot + slot / 2}
                  y={height - 6}
                  textAnchor="middle"
                  {...AXIS}
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {active && hover !== null ? (
        <Tooltip x={pad.left + hover * slot + slot / 2} width={width}>
          <p className="font-semibold">
            {active.total} review{active.total === 1 ? "" : "s"}
          </p>
          <p className="text-muted mb-1">{active.label}</p>
          {[4, 3, 2, 1, 0].map((s) =>
            active.stars[s] ? (
              <p key={s} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: STAR_COLORS[s] }} />
                <span className="font-semibold tabular-nums">{active.stars[s]}</span>
                <span className="text-muted">{s + 1}★</span>
              </p>
            ) : null,
          )}
        </Tooltip>
      ) : null}
    </div>
  );
}

export function RatingLine({
  data,
  height = 200,
}: {
  data: { label: string; value: number | null }[];
  height?: number;
}) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 24, left: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  const x = (i: number) => pad.left + (data.length > 1 ? i * step : plotW / 2);
  const y = (v: number) => pad.top + plotH - ((v - 1) / 4) * plotH;
  const segments: string[] = [];
  let current = "";
  data.forEach((d, i) => {
    if (d.value === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${x(i)},${y(d.value)} `;
  });
  if (current) segments.push(current);
  const every = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
  const lastIndex = data.map((d) => d.value).findLastIndex((v) => v !== null);
  const active = hover === null ? null : data[hover];
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Average rating over time"
        className="block"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const i = Math.round((e.clientX - box.left - pad.left) / (step || 1));
          setHover(Math.min(Math.max(i, 0), data.length - 1));
        }}
      >
        {[1, 2, 3, 4, 5].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 1 ? "var(--chart-axis)" : "var(--chart-grid)"}
            />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" {...AXIS}>
              {t}★
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" {...AXIS}>
              {d.label}
            </text>
          ) : null,
        )}
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {data.map((d, i) =>
          d.value !== null && (i === lastIndex || hover === i || segments.length > 1) ? (
            <circle
              key={i}
              cx={x(i)}
              cy={y(d.value)}
              r={4}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ) : null,
        )}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={pad.top + plotH}
            stroke="var(--chart-axis)"
          />
        ) : null}
        {lastIndex >= 0 ? (
          <text
            x={Math.min(x(lastIndex) + 8, width - 4)}
            y={y(data[lastIndex]!.value!) - 8}
            textAnchor="end"
            className="fill-[var(--foreground)] text-[12px] font-semibold"
          >
            {data[lastIndex]!.value!.toFixed(1)}
          </text>
        ) : null}
      </svg>
      {active && hover !== null ? (
        <Tooltip x={x(hover)} width={width}>
          <p className="font-semibold">
            {active.value === null ? "No reviews" : `${active.value.toFixed(2)}★ average`}
          </p>
          <p className="text-muted">{active.label}</p>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function HBars({
  rows,
  max,
  format,
  color = "var(--accent)",
  label,
}: {
  rows: { key: string; label: ReactNode; value: number; detail?: string; color?: string }[];
  max?: number;
  format: (v: number) => string;
  color?: string;
  label: string;
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="grid gap-2.5" aria-label={label}>
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]"
        >
          <span
            className="text-small truncate"
            title={typeof r.label === "string" ? r.label : undefined}
          >
            {r.label}
          </span>
          <span className="flex items-center gap-2" title={r.detail}>
            <svg
              className="h-3.5 min-w-0 flex-1"
              viewBox="0 0 100 14"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d={roundedRight(0, 1, Math.max(1.5, (r.value / top) * 100), 12, 4)}
                fill={r.color ?? color}
              />
            </svg>
            <span className="text-caption w-16 shrink-0 text-right font-semibold tabular-nums">
              {format(r.value)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const w = 96;
  const h = 28;
  const points = values.map((v, i) =>
    v === null
      ? null
      : {
          x: (i / Math.max(values.length - 1, 1)) * (w - 6) + 3,
          y: 3 + (1 - (v - 1) / 4) * (h - 6),
        },
  );
  const d = points.reduce((acc, p, i) => {
    if (!p) return acc;
    const prev = points[i - 1];
    return `${acc}${prev ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
  }, "");
  const last = [...points].reverse().find(Boolean);
  if (!last) return null;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--subtle)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.6}
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={3}
        fill="var(--accent)"
        stroke="var(--surface)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: { text: string; good: boolean | null } | null;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-small text-muted">{label}</p>
      <p className="text-[26px] leading-8 font-semibold tracking-tight">{value}</p>
      {delta ? (
        <p
          className={cn(
            "text-caption font-medium",
            delta.good === null ? "text-muted" : delta.good ? "text-success" : "text-danger",
          )}
        >
          {delta.good === null ? "" : delta.good ? "▲ " : "▼ "}
          {delta.text}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted">{hint}</p>
      ) : null}
    </Card>
  );
}
