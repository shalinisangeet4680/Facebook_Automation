"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import type { AnalyticsRange } from "@/lib/api/queries";
import {
  type GbpLocationDetail,
  useBusinessAnalytics,
  useLocation,
  useLocationReviews,
  useSyncLocation,
} from "@/lib/api/business";
import { RatingMix, TrendChart } from "@/features/replyly/charts";
import { RangePicker, rangeTitle } from "@/features/replyly/range-picker";
import { ago, minutesLabel } from "@/features/replyly/tokens";
import { Banner, Seg, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { InfoTab } from "./info-tab";
import { InsightsPanel } from "./insights-panel";
import { LocationTile } from "./location-tile";
import { PostsPanel } from "./posts-panel";
import { BusinessReviewCard } from "./review-card";
import { SettingsTab } from "./settings-tab";
import { useLocationColors } from "./shell";

const TABS = ["reviews", "posts", "insights", "info", "settings"] as const;
type Tab = (typeof TABS)[number];
const MUTED = "#6C6962";

export function LocationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const param = params.get("tab");
  const tab: Tab = TABS.includes(param as Tab) ? (param as Tab) : "reviews";
  const location = useLocation(id);
  const { color } = useLocationColors();
  const toast = useToast();
  const sync = useSyncLocation(id);
  const [now] = useState(() => Date.now());

  if (location.error)
    return (
      <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link
          href="/business/locations"
          className="rp-btn-quiet"
          style={{ alignSelf: "flex-start" }}
        >
          ← All locations
        </Link>
        <Banner tone="error">{errorMessage(location.error)}</Banner>
      </div>
    );

  const l = location.data;
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Link
        href="/business/locations"
        className="rp-btn-quiet"
        style={{ alignSelf: "flex-start", textDecoration: "none" }}
      >
        ← All locations
      </Link>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {l ? <LocationTile color={color(l.id)} size={52} /> : <Skel h={52} w={52} r={14} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h1 className="rp-serif" style={{ fontSize: 34, lineHeight: 1 }}>
              {l?.title ?? " "}
            </h1>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12.5,
                color: MUTED,
                flexWrap: "wrap",
              }}
            >
              {l?.rating ? (
                <span>
                  <span style={{ color: "#C9A227" }}>★</span> {l.rating.toFixed(1)} ·{" "}
                  {l.totalReviews.toLocaleString()} reviews
                </span>
              ) : null}
              {l?.address ? <span>{l.address}</span> : null}
              {l?.mapsUri ? (
                <a
                  href={l.mapsUri}
                  target="_blank"
                  rel="noreferrer"
                  className="rp-store-link"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Maps ↗
                </a>
              ) : null}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "7px 12px" }}
            disabled={sync.isPending || !l}
            onClick={() =>
              sync.mutate(undefined, {
                onSuccess: (r) =>
                  toast(
                    r.created
                      ? `${r.created} new review${r.created === 1 ? "" : "s"}`
                      : "Up to date",
                  ),
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {sync.isPending ? <Spinner size={11} dark /> : null}
            Sync
          </button>
          <Seg
            label="Location sections"
            value={tab}
            onChange={(t) =>
              router.replace(t === "reviews" ? `/business/${id}` : `/business/${id}?tab=${t}`, {
                scroll: false,
              })
            }
            options={[
              { id: "reviews", label: "Reviews" },
              { id: "posts", label: "Posts" },
              { id: "insights", label: "Insights" },
              { id: "info", label: "Info" },
              { id: "settings", label: "Settings" },
            ]}
          />
        </div>
      </div>
      {!l ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Skel h={86} r={14} />
          <Skel h={240} r={14} />
        </div>
      ) : (
        <>
          {l.syncError ? (
            <Banner tone="error" title="Sync failed">
              {l.syncError}
            </Banner>
          ) : null}
          {l.pauseReason && l.pausedUntil && Date.parse(l.pausedUntil) > now ? (
            <Banner tone="warn" title="Safety pause">
              {l.pauseReason}
            </Banner>
          ) : null}
          {!l.verified ? (
            <Banner
              tone="warn"
              title={
                l.verificationState === "pending"
                  ? "Unverified — enter your code from Google"
                  : "Unverified — finish verification"
              }
              action={
                <Link
                  href={`/business/${l.id}/verify`}
                  className="rp-btn"
                  style={{ padding: "7px 12px" }}
                >
                  {l.verificationState === "pending" ? "Enter code" : "Finish verification"}
                </Link>
              }
            >
              Google hides this profile, its replies and posts until it’s verified.
            </Banner>
          ) : null}
          {tab === "reviews" ? (
            <ReviewsTab location={l} color={color(l.id)} />
          ) : tab === "posts" ? (
            <PostsPanel locationId={l.id} />
          ) : tab === "insights" ? (
            <InsightsTab location={l} />
          ) : tab === "info" ? (
            <InfoTab location={l} />
          ) : (
            <SettingsTab location={l} />
          )}
        </>
      )}
    </div>
  );
}

function ReviewsTab({ location, color }: { location: GbpLocationDetail; color: string }) {
  const [stars, setStars] = useState<number | undefined>(undefined);
  const [state, setState] = useState<"open" | "done" | "all">("open");
  const reviews = useLocationReviews(location.id, stars);
  const all = reviews.data?.data ?? [];
  const open = all.filter((r) =>
    ["waiting", "claude", "scheduled", "unreplied", "failed"].includes(r.state),
  );
  const done = all.filter((r) => r.state === "replied" || r.state === "skipped");
  const list = state === "open" ? open : state === "done" ? done : all;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Seg
          label="Reply state"
          value={state}
          onChange={setState}
          small
          options={[
            { id: "open", label: "Needs reply", n: open.length },
            { id: "done", label: "Replied", n: done.length },
            { id: "all", label: "All", n: all.length },
          ]}
        />
        <Seg
          label="Stars"
          value={stars ? String(stars) : "any"}
          onChange={(v) => setStars(v === "any" ? undefined : Number(v))}
          small
          options={[
            { id: "any", label: "All ★" },
            ...[5, 4, 3, 2, 1].map((n) => ({ id: String(n), label: `${n}★` })),
          ]}
        />
      </div>
      {reviews.isPending ? (
        <Skel h={200} />
      ) : list.length ? (
        list.map((r) => (
          <BusinessReviewCard key={r.id} review={r} color={color} locationName={location.title} />
        ))
      ) : (
        <div className="rp-card" style={{ padding: 24, color: MUTED, fontSize: 13.5 }}>
          {state === "open" ? "Every review here has a reply." : "No reviews match."}
        </div>
      )}
    </div>
  );
}

function InsightsTab({ location }: { location: GbpLocationDetail }) {
  const [range, setRange] = useState<AnalyticsRange>({ kind: "days", days: 30 });
  const stats = useBusinessAnalytics(range, location.id);
  const w = stats.data;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: MUTED }}>
          How people find and contact {location.title} on Google. Last synced{" "}
          {ago(location.lastSyncedAt)}.
        </span>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <InsightsPanel range={range} locationId={location.id} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 20,
        }}
      >
        <div
          className="rp-card rp-span2"
          style={{ gridColumn: "span 2", minWidth: 0, padding: 18 }}
        >
          {w ? (
            <TrendChart
              title={`Reviews vs. replies · ${rangeTitle(range)}`}
              series={w.series}
              height={200}
              rating
            />
          ) : (
            <Skel h={240} />
          )}
        </div>
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <span style={{ fontWeight: 500 }}>Rating mix</span>
          {w ? <RatingMix dist={w.distribution} /> : <Skel h={120} />}
          {w ? (
            <span style={{ fontSize: 12.5, color: MUTED }}>
              Reply rate {w.current.replyRate ?? "—"}% · median response{" "}
              {minutesLabel(w.current.medianResponseMinutes)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
