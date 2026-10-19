"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useTracking } from "@/lib/api/queries";
import type { Tracking, TrackingStatus } from "@/lib/api/types";
import { timeAgo } from "@/features/meta/format";
import { CardTitle, MUTED, Pill, SOFT, cardHead } from "@/features/meta/ui";
import { Banner, Skel, Spinner } from "@/features/replyly/ui";

const STATUS: Record<TrackingStatus, { label: string; tone: "success" | "warn" | "danger" }> = {
  healthy: { label: "Working", tone: "success" },
  warning: { label: "Needs a look", tone: "warn" },
  missing: { label: "Not set up", tone: "danger" },
};

const GOAL_NAMES: Record<string, string> = {
  traffic: "website visits",
  leads: "enquiries",
  instant_leads: "instant form leads",
  sales: "online sales",
  awareness: "getting known",
};

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function TrackingStatusPill({ status }: { status: TrackingStatus }) {
  const s = STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function goalReady(report: Tracking | undefined, goal: string | null) {
  if (!report || !goal) return null;
  return report.goals.find((g) => g.goal === goal) ?? null;
}

function EventsTable({ report, limit }: { report: Tracking; limit: number }) {
  const rows = report.events.slice(0, limit);
  if (!rows.length)
    return <span style={{ fontSize: 13, color: MUTED }}>No events in the last 7 days.</span>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ color: MUTED, fontSize: 11.5, textAlign: "left" }}>
          <th style={{ fontWeight: 500, padding: "0 0 6px" }}>Event</th>
          <th style={{ fontWeight: 500, padding: "0 0 6px", textAlign: "right" }}>24 hours</th>
          <th style={{ fontWeight: 500, padding: "0 0 6px", textAlign: "right" }}>7 days</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.event} style={{ borderTop: "1px solid #EFEDE8" }}>
            <td style={{ padding: "7px 0", overflowWrap: "anywhere" }}>{e.event}</td>
            <td className="rp-mono" style={{ padding: "7px 0", textAlign: "right" }}>
              {e.last24Hours.toLocaleString("en-IN")}
            </td>
            <td className="rp-mono" style={{ padding: "7px 0", textAlign: "right" }}>
              {e.last7Days.toLocaleString("en-IN")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FixList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 18,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 13,
        color: SOFT,
        lineHeight: 1.5,
      }}
    >
      {items.map((fix) => (
        <li key={fix}>{fix}</li>
      ))}
    </ul>
  );
}

function EventsManagerLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rp-btn-light"
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      Open Events Manager <ExternalLink size={13} />
    </a>
  );
}

export function TrackingSummary({
  report,
  goal,
  limit = 5,
}: {
  report: Tracking;
  goal?: string | null;
  limit?: number;
}) {
  const now = useNow();
  const fit = goalReady(report, goal ?? null);
  const fired = report.pixel ? timeAgo(report.pixel.lastFiredTime, now) : null;
  const fixes = [...(fit && !fit.ready && fit.fix ? [fit.fix] : []), ...report.fixes].filter(
    (f, i, all) => all.indexOf(f) === i,
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <TrackingStatusPill status={report.status} />
        <span style={{ fontSize: 13, color: SOFT, overflowWrap: "anywhere" }}>
          {report.pixel
            ? `${report.pixel.name} · ${fired ? `last event ${fired}` : "no events yet"}`
            : "No Pixel selected"}
        </span>
      </div>
      {fit ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 10,
            background: fit.ready ? "#F1F5F2" : "#FBF3E2",
            color: fit.ready ? "#0F3D2C" : "#8A5A00",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ fontWeight: 600 }}>
            {fit.ready
              ? `Ready for ${GOAL_NAMES[fit.goal] ?? fit.goal}. `
              : `Not ready for ${GOAL_NAMES[fit.goal] ?? fit.goal} yet. `}
          </strong>
          {fit.message}
        </p>
      ) : null}
      {report.reasons.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {report.reasons.map((r) => (
            <span key={r} style={{ fontSize: 13, color: "#8A5A00" }}>
              {r}
            </span>
          ))}
        </div>
      ) : null}
      {report.selected ? <EventsTable report={report} limit={limit} /> : null}
      {fixes.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="rp-label">How to fix it</span>
          <FixList items={fixes} />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {report.selected ? (
          <EventsManagerLink url={report.eventsManagerUrl} />
        ) : (
          <Link href="/setup/accounts" className="rp-btn-light">
            Choose a Pixel
          </Link>
        )}
      </div>
    </div>
  );
}

export function TrackingCard() {
  const tracking = useTracking();
  return (
    <section className="rp-card" aria-labelledby="tracking-title" style={{ overflow: "hidden" }}>
      <div style={cardHead}>
        <CardTitle
          title={<span id="tracking-title">Tracking</span>}
          sub="Whether your Pixel records the visits, enquiries and sales your ads bring."
        />
        <button
          type="button"
          className="rp-btn-quiet"
          disabled={tracking.isFetching}
          onClick={() => void tracking.refetch()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {tracking.isFetching ? <Spinner dark /> : <RefreshCw size={13} />}
          Check again
        </button>
      </div>
      <div style={{ padding: 18 }}>
        {tracking.isPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel h={18} w={220} />
            <Skel h={90} r={10} />
          </div>
        ) : tracking.isError ? (
          <span style={{ fontSize: 13, color: MUTED }}>
            Couldn’t check tracking: {errorMessage(tracking.error)}
          </span>
        ) : (
          <TrackingSummary report={tracking.data} />
        )}
      </div>
    </section>
  );
}

export function TrackingGoalWarning({ goal }: { goal: string | null }) {
  const needs = goal === "leads" || goal === "sales";
  const tracking = useTracking(needs);
  const fit = goalReady(tracking.data, goal);
  if (!needs || !fit || fit.ready) return null;
  return (
    <Banner
      tone="warn"
      title="Your Pixel isn’t ready for this goal yet"
      action={
        tracking.data?.selected ? (
          <a
            href={tracking.data.eventsManagerUrl}
            target="_blank"
            rel="noreferrer"
            className="rp-btn-light"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Events Manager <ExternalLink size={13} />
          </a>
        ) : (
          <Link href="/setup/accounts" className="rp-btn-light">
            Choose a Pixel
          </Link>
        )
      }
    >
      {fit.message} {fit.fix} You can still build the plan, but Meta can’t optimise for results it
      doesn’t see.
    </Banner>
  );
}
