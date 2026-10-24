"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import type { AnalyticsRange } from "@/lib/api/queries";
import {
  type GbpLocationDetail,
  useBusinessAnalytics,
  useLocation,
  useBusinessMedia,
  useLocationReviews,
  useSyncLocation,
} from "@/lib/api/business";
import { RatingMix, TrendChart } from "@/features/replyly/charts";
import { RangePicker, rangeTitle } from "@/features/replyly/range-picker";
import { ago, minutesLabel } from "@/features/replyly/tokens";
import { useToast } from "@/features/replyly/ui";

import { InfoTab } from "./info-tab";
import { InsightsPanel } from "./insights-panel";
import { Spin } from "./location-ui";
import { MediaGallery, logoOf } from "./media";
import { PostsPanel } from "./posts-panel";
import { BusinessReviewCard } from "./review-card";
import { SettingsTab } from "./settings-tab";
import { useLocationColors } from "./shell";
import { Notice, Seg, Skel, Swatch } from "./ui";

const TABS = ["reviews", "posts", "media", "insights", "info", "settings"] as const;
type Tab = (typeof TABS)[number];

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
  const logo = logoOf(useBusinessMedia(id).data?.items);
  const [now] = useState(() => Date.now());

  if (location.error)
    return (
      <div className="gb-lp">
        <Link href="/business/locations" className="gb-link gb-lp-back">
          ← Locations
        </Link>
        <Notice tone="error">{errorMessage(location.error)}</Notice>
      </div>
    );

  const l = location.data;
  return (
    <div className="gb-lp">
      <Link href="/business/locations" className="gb-link gb-lp-back">
        ← Locations
      </Link>
      <div className="gb-lp-head">
        <div className="gb-lp-id">
          {l && logo ? (
            <Image
              unoptimized
              src={logo.thumbnailUrl}
              alt=""
              width={44}
              height={44}
              referrerPolicy="no-referrer"
              className="gb-lp-logo"
            />
          ) : l ? (
            <Swatch color={color(l.id)} label={l.title} size={44} />
          ) : (
            <Skel h={44} w={44} r={11} />
          )}
          <div className="gb-lp-id-text">
            {l ? <h1 className="gb-h1">{l.title}</h1> : <Skel h={28} w={220} r={8} />}
            <span className="gb-lp-meta">
              {l?.rating ? (
                <span>
                  <span className="gb-lp-star">★</span> {l.rating.toFixed(1)} ·{" "}
                  {l.totalReviews.toLocaleString()} reviews
                </span>
              ) : null}
              {l?.address ? <span>{l.address}</span> : null}
              {l?.mapsUri ? (
                <a href={l.mapsUri} target="_blank" rel="noreferrer">
                  Maps ↗
                </a>
              ) : null}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="gb-btn"
          disabled={sync.isPending || !l}
          onClick={() =>
            sync.mutate(undefined, {
              onSuccess: (r) =>
                toast(
                  r.created ? `${r.created} new review${r.created === 1 ? "" : "s"}` : "Up to date",
                ),
              onError: (err) => toast(errorMessage(err)),
            })
          }
        >
          {sync.isPending ? <Spin light /> : null}
          Sync
        </button>
      </div>
      <div className="gb-lp-tabs">
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
            { id: "media", label: "Media" },
            { id: "insights", label: "Insights" },
            { id: "info", label: "Info" },
            { id: "settings", label: "Settings" },
          ]}
        />
      </div>
      {!l ? (
        <div className="gb-lp-col">
          <Skel h={86} r={14} />
          <Skel h={240} r={14} />
        </div>
      ) : (
        <>
          {l.syncError ? (
            <Notice tone="error">
              <span className="gb-lp-notice-title">Sync failed</span>
              {l.syncError}
            </Notice>
          ) : null}
          {l.pauseReason && l.pausedUntil && Date.parse(l.pausedUntil) > now ? (
            <Notice tone="warn">
              <span className="gb-lp-notice-title">Safety pause</span>
              {l.pauseReason}
            </Notice>
          ) : null}
          {!l.verified ? (
            <Notice
              tone="warn"
              action={
                <Link href={`/business/${l.id}/verify`} className="gb-btn gb-btn-dark">
                  {l.verificationState === "pending" ? "Enter code" : "Finish verification"}
                </Link>
              }
            >
              <span className="gb-lp-notice-title">
                {l.verificationState === "pending"
                  ? "Unverified — enter your code from Google"
                  : "Unverified — finish verification"}
              </span>
              Google hides this profile, its replies and posts until it’s verified.
            </Notice>
          ) : null}
          {tab === "reviews" ? (
            <ReviewsTab location={l} color={color(l.id)} />
          ) : tab === "posts" ? (
            <PostsPanel locationId={l.id} />
          ) : tab === "media" ? (
            <MediaGallery locationId={l.id} />
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
    <div className="gb-lp-col">
      <div className="gb-lp-bar">
        <div className="gb-lp-scroll">
          <Seg
            label="Reply state"
            value={state}
            onChange={setState}
            options={[
              { id: "open", label: "Needs reply", n: open.length },
              { id: "done", label: "Replied", n: done.length },
              { id: "all", label: "All", n: all.length },
            ]}
          />
        </div>
        <div className="gb-lp-scroll">
          <Seg
            label="Stars"
            value={stars ? String(stars) : "any"}
            onChange={(v) => setStars(v === "any" ? undefined : Number(v))}
            options={[
              { id: "any", label: "All ★" },
              ...[5, 4, 3, 2, 1].map((n) => ({ id: String(n), label: `${n}★` })),
            ]}
          />
        </div>
      </div>
      {reviews.isPending ? (
        <Skel h={200} r={14} />
      ) : list.length ? (
        list.map((r) => (
          <BusinessReviewCard key={r.id} review={r} color={color} locationName={location.title} />
        ))
      ) : (
        <div className="gb-card gb-lp-empty">
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
    <div className="gb-lp-col" style={{ gap: 20 }}>
      <div className="gb-lp-bar">
        <span className="gb-sub">
          How people find and contact {location.title} on Google. Last synced{" "}
          {ago(location.lastSyncedAt)}.
        </span>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <InsightsPanel range={range} locationId={location.id} />
      <div className="gb-lp-insight-grid">
        <div className="gb-card gb-card-pad" style={{ minWidth: 0 }}>
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
        <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 12 }}>
          <span className="gb-title">Rating mix</span>
          {w ? <RatingMix dist={w.distribution} /> : <Skel h={120} />}
          {w ? (
            <span className="gb-faint">
              Reply rate {w.current.replyRate ?? "—"}% · median response{" "}
              {minutesLabel(w.current.medianResponseMinutes)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
