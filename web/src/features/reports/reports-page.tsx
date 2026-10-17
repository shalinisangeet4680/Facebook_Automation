"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { useReport } from "@/lib/api/queries";
import type { ReportOverview, ReportPreset } from "@/lib/api/types";
import { Banner, PageHead, Seg, Skel } from "@/features/replyly/ui";

const A = "#0F6B4A";
const MUTED = "#6C6962";
const LINE = "1px solid #EFEDE8";

const PRESETS: { id: ReportPreset; label: string }[] = [
  { id: "last_7d", label: "7 days" },
  { id: "last_14d", label: "14 days" },
  { id: "last_30d", label: "30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

const RESULT_LABELS: Record<string, string> = {
  lead: "Leads",
  "offsite_conversion.fb_pixel_lead": "Leads",
  complete_registration: "Sign-ups",
  purchase: "Purchases",
  "offsite_conversion.fb_pixel_purchase": "Purchases",
  landing_page_view: "Page views",
  link_click: "Clicks",
};

const dateLabel = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const count = new Intl.NumberFormat("en-IN");
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const day = (iso: string) => dateLabel.format(new Date(`${iso}T00:00:00Z`));

function moneyFormatter(currency: string, digits = 0) {
  const f = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  });
  return (v: number) => f.format(v);
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 6, 8, 10].find((s) => s * exp >= value) ?? 10;
  return step * exp;
}

const CHART_H = 180;
const PAD = { top: 10, right: 4, bottom: 24, left: 52 };

function BarChart({
  title,
  data,
  unit,
  format,
}: {
  title: string;
  data: { date: string; value: number }[];
  unit: string;
  format: (v: number) => string;
}) {
  const id = useId();
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
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(26, slot * 0.6));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64)));
  const active = hover === null ? null : data[hover];

  return (
    <div
      className="rp-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}
    >
      <span id={id} style={{ fontWeight: 600 }}>
        {title}
      </span>
      <div ref={ref} style={{ position: "relative", width: "100%" }}>
        <svg
          width={width}
          height={CHART_H}
          role="img"
          aria-labelledby={id}
          style={{ display: "block" }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "#E6E4DF" : "#EFEDE8"}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                style={{ fontSize: 11, fill: MUTED, fontFamily: "var(--rp-mono)" }}
              >
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const top = y(d.value);
            const h = Math.max(0, PAD.top + plotH - top);
            const r = Math.min(3, barW / 2, h);
            return (
              <g key={d.date}>
                {h > 0 ? (
                  <path
                    d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                    fill={A}
                    opacity={hover === null || hover === i ? 1 : 0.35}
                  />
                ) : null}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                {i % labelEvery === 0 ? (
                  <text
                    x={PAD.left + i * slot + slot / 2}
                    y={CHART_H - 6}
                    textAnchor="middle"
                    style={{ fontSize: 11, fill: MUTED, fontFamily: "var(--rp-mono)" }}
                  >
                    {day(d.date)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {active && hover !== null ? (
          <div
            role="presentation"
            style={{
              position: "absolute",
              top: 0,
              left: Math.min(Math.max(PAD.left + hover * slot + slot / 2, 64), width - 64),
              transform: "translateX(-50%)",
              padding: "7px 10px",
              borderRadius: 8,
              background: "#191917",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)",
            }}
          >
            <div style={{ color: "#C9C5BC" }}>{day(active.date)}</div>
            <div>
              {format(active.value)} {unit}
            </div>
          </div>
        ) : null}
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
        <caption>{title}</caption>
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

function Kpi({
  label,
  value,
  current,
  previous,
  goodWhen,
  note,
}: {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
  goodWhen: "up" | "down" | "neutral";
  note?: ReactNode;
}) {
  const change = current !== null && previous ? ((current - previous) / previous) * 100 : null;
  const direction = change === null || Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const good = goodWhen === "neutral" || direction === "flat" ? null : direction === goodWhen;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <div
      className="rp-card"
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12.5, color: MUTED }}>{label}</span>
      <span
        className="rp-serif"
        style={{
          fontSize: 30,
          lineHeight: 1.1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {change === null ? (
          <span style={{ fontSize: 12, color: MUTED }}>No earlier data</span>
        ) : (
          <span
            className="rp-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              fontSize: 12,
              color: good === null ? MUTED : good ? A : "#B42318",
            }}
          >
            <Icon size={13} aria-hidden />
            {Math.abs(change).toFixed(0)}%
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              {" "}
              {direction === "up" ? "higher" : direction === "down" ? "lower" : ""} than the
              previous period
            </span>
          </span>
        )}
        {note}
      </span>
    </div>
  );
}

function Pill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      style={{
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: ok ? "#EAF3EE" : "#FBF3E2",
        color: ok ? A : "#8A5A00",
      }}
    >
      {children}
    </span>
  );
}

function EmptyCard({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div
      className="rp-card"
      style={{
        padding: "36px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <span className="rp-serif" style={{ fontSize: 26 }}>
        {title}
      </span>
      <span style={{ fontSize: 13, color: MUTED, maxWidth: 420 }}>{text}</span>
      <div style={{ marginTop: 8 }}>{action}</div>
    </div>
  );
}

const th: CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 500,
  color: MUTED,
  textAlign: "right",
  whiteSpace: "nowrap",
};
const td: CSSProperties = { padding: "12px", textAlign: "right", verticalAlign: "top" };
const sub: CSSProperties = { display: "block", fontSize: 11.5, color: MUTED, marginTop: 2 };

const tileGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

function Report({ data, refreshing }: { data: ReportOverview; refreshing: boolean }) {
  const money = moneyFormatter(data.currency);
  const money2 = moneyFormatter(data.currency, 2);
  const k = data.kpis;
  const p = data.previousKpis;
  const target = data.targetCostPerResult;

  if (k.spend === 0 && k.impressions === 0) {
    return (
      <EmptyCard
        title="No ads ran in this period"
        text="Once a campaign is live, spend and results show up here within a few hours."
        action={
          <Link href="/campaigns" className="rp-btn-light">
            Plan a campaign
          </Link>
        }
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        opacity: refreshing ? 0.7 : 1,
        transition: "opacity .2s",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={tileGrid}>
          <Kpi
            label="Spend"
            value={money(k.spend)}
            current={k.spend}
            previous={p.spend}
            goodWhen="neutral"
          />
          <Kpi
            label="Results"
            value={count.format(k.results)}
            current={k.results}
            previous={p.results}
            goodWhen="up"
          />
          <Kpi
            label="Cost per result"
            value={k.costPerResult === null ? "—" : money2(k.costPerResult)}
            current={k.costPerResult}
            previous={p.costPerResult}
            goodWhen="down"
            note={
              target !== null && k.costPerResult !== null ? (
                <Pill ok={k.costPerResult <= target}>Target {money(target)}</Pill>
              ) : null
            }
          />
          <Kpi
            label="Link CTR"
            value={k.ctr === null ? "—" : `${k.ctr.toFixed(2)}%`}
            current={k.ctr}
            previous={p.ctr}
            goodWhen="up"
          />
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 20px",
            fontSize: 12.5,
            color: MUTED,
          }}
        >
          {[
            ["Reach", compact.format(k.reach)],
            ["Impressions", compact.format(k.impressions)],
            ["Link clicks", count.format(k.linkClicks)],
            ["CPM", k.cpm === null ? "—" : money2(k.cpm)],
          ].map(([label, value]) => (
            <span key={label}>
              {label}{" "}
              <span className="rp-mono" style={{ color: "#191917" }}>
                {value}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
          gap: 18,
        }}
      >
        <BarChart
          title="Spend per day"
          unit="spend"
          data={data.daily.map((d) => ({ date: d.date, value: d.spend }))}
          format={money}
        />
        <BarChart
          title="Results per day"
          unit="results"
          data={data.daily.map((d) => ({ date: d.date, value: d.results }))}
          format={(v) => count.format(Math.round(v))}
        />
      </div>

      <div className="rp-card" style={{ overflow: "hidden", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: LINE, fontWeight: 600 }}>Campaigns</div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13.5 }}
          >
            <thead>
              <tr style={{ borderBottom: LINE }}>
                <th scope="col" style={{ ...th, textAlign: "left", paddingLeft: 18 }}>
                  Campaign
                </th>
                <th scope="col" style={th}>
                  Spend
                </th>
                <th scope="col" style={th}>
                  Results
                </th>
                <th scope="col" style={th}>
                  Cost / result
                </th>
                <th scope="col" style={{ ...th, paddingRight: 18 }}>
                  CTR
                </th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i ? LINE : "none" }}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: 18 }}>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span style={{ ...sub, textTransform: "capitalize" }}>
                      {c.status === "ACTIVE" ? "Active" : c.status.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="rp-mono" style={td}>
                    {money(c.spend)}
                  </td>
                  <td className="rp-mono" style={td}>
                    {count.format(c.results)}
                    {c.resultType ? (
                      <span style={{ ...sub, fontFamily: "var(--rp-sans)" }}>
                        {RESULT_LABELS[c.resultType] ?? c.resultType}
                      </span>
                    ) : null}
                  </td>
                  <td className="rp-mono" style={td}>
                    {c.costPerResult === null ? "—" : money2(c.costPerResult)}
                    {target !== null && c.costPerResult !== null ? (
                      <span
                        style={{
                          ...sub,
                          fontFamily: "var(--rp-sans)",
                          color: c.costPerResult <= target ? A : "#8A5A00",
                        }}
                      >
                        {c.costPerResult <= target ? "Within target" : "Above target"}
                      </span>
                    ) : null}
                  </td>
                  <td className="rp-mono" style={{ ...td, paddingRight: 18 }}>
                    {c.ctr === null ? "—" : `${c.ctr.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.topAds.length ? (
        <div className="rp-card" style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: LINE, fontWeight: 600 }}>Best ads</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {data.topAds.map((ad, i) => (
              <li
                key={ad.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 18px",
                  borderTop: i ? LINE : "none",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="rp-mono"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    background: i === 0 ? "#191917" : "#EFEDE8",
                    color: i === 0 ? "#fff" : MUTED,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    flex: "1 1 180px",
                    minWidth: 0,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ad.name}
                </span>
                <span className="rp-mono" style={{ fontSize: 12.5, color: MUTED }}>
                  {count.format(ad.results)} results ·{" "}
                  {ad.costPerResult === null ? "—" : money2(ad.costPerResult)} each
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function ReportsPage() {
  const [preset, setPreset] = useState<ReportPreset>("last_7d");
  const report = useReport(preset);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHead
        title="Reports"
        sub={
          report.data
            ? `${day(report.data.period.since)} – ${day(report.data.period.until)}, compared with the period before.`
            : "How your ads are doing."
        }
      />
      <div style={{ overflowX: "auto", alignSelf: "flex-start", maxWidth: "100%" }}>
        <Seg label="Period" value={preset} onChange={setPreset} small options={PRESETS} />
      </div>
      {report.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={tileGrid}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skel key={i} h={104} r={14} />
            ))}
          </div>
          <Skel h={250} r={14} />
        </div>
      ) : report.isError ? (
        report.error instanceof ApiError && report.error.code === "META_NOT_CONNECTED" ? (
          <EmptyCard
            title="Connect Meta to see reports"
            text="Reports read results straight from your ad account."
            action={
              <Link href="/setup/connect-meta" className="rp-btn">
                Connect Meta
              </Link>
            }
          />
        ) : (
          <Banner
            tone="error"
            title="Couldn’t load reports"
            action={
              <button type="button" className="rp-btn-light" onClick={() => void report.refetch()}>
                Try again
              </button>
            }
          >
            {errorMessage(report.error)}
          </Banner>
        )
      ) : (
        <Report data={report.data} refreshing={report.isFetching} />
      )}
    </div>
  );
}
