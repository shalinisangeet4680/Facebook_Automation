"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpLocation,
  useDiscoverLocations,
  useLocation,
  useLocations,
  useUpdateLocation,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { useGoogleConnected, useLocationColors, useLocationFilter } from "./shell";
import { Notice, Skel, Swatch } from "./ui";
import "./locations.css";

type Pick = "auto" | "approval";

const MODES: [Pick, string][] = [
  ["auto", "Auto"],
  ["approval", "Approve"],
];

function Row({ l, color }: { l: GbpLocation; color: string }) {
  const router = useRouter();
  const toast = useToast();
  const { setLoc } = useLocationFilter();
  const detail = useLocation(l.id);
  const update = useUpdateLocation(l.id);
  const rules = detail.data?.settings.ratingRules;
  const waiting = l.needsReply;

  const pick = (mode: Pick, label: string) => {
    if (!rules || l.mode === mode) return;
    update.mutate(
      { ratingRules: rules.map((r) => ({ rating: r.rating, mode, templateId: r.templateId })) },
      {
        onSuccess: () => toast(`${l.title}: ${label}`),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <div className="gb-locations-row">
      <div className="gb-locations-who">
        <Swatch color={color} label={l.title} />
        <div style={{ minWidth: 0 }}>
          <div className="gb-locations-name">
            <Link href={`/business/${l.id}`} className="gb-locations-link">
              {l.title}
            </Link>
            {!l.verified ? (
              <Link
                href={`/business/${l.id}/verify`}
                className={`gb-pill ${l.verificationState === "pending" ? "gb-pill-amber" : "gb-pill-grey"}`}
              >
                {l.verificationState === "pending" ? "Pending" : "Unverified"}
              </Link>
            ) : null}
            {l.pauseReason ? (
              <span className="gb-pill gb-pill-amber" title={l.pauseReason}>
                Paused
              </span>
            ) : null}
          </div>
          {l.syncError ? (
            <div className="gb-locations-sub gb-locations-error" title={l.syncError}>
              Sync failed: {l.syncError}
            </div>
          ) : (
            <div className="gb-locations-sub">{l.category ?? l.address ?? ""}</div>
          )}
        </div>
      </div>
      <span className="gb-locations-num gb-desk">
        {l.rating === null ? (
          <span className="gb-faint">—</span>
        ) : (
          <>
            {l.rating.toFixed(1)} <span style={{ color: "var(--gb-star)" }}>★</span>
          </>
        )}
      </span>
      <span className="gb-locations-total gb-desk">{l.totalReviews.toLocaleString()}</span>
      <button
        type="button"
        className={waiting ? "gb-locations-wait gb-locations-wait-on" : "gb-locations-wait"}
        aria-label={
          waiting ? `${waiting} waiting at ${l.title}, open reviews` : `None waiting at ${l.title}`
        }
        onClick={() => {
          setLoc(l.id);
          router.push("/business/reviews");
        }}
      >
        {waiting ? `${waiting} waiting` : "None"}
      </button>
      <div className="gb-locations-mode">
        <div className="gb-seg gb-seg-fill" role="group" aria-label={`Replies for ${l.title}`}>
          {MODES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={l.mode === m}
              className="gb-seg-btn"
              disabled={!rules || update.isPending}
              onClick={() => pick(m, label)}
            >
              {label}
            </button>
          ))}
        </div>
        {l.mode === "manual" || l.mode === "mixed" ? (
          <span className="gb-locations-hint">{l.mode === "manual" ? "Manual" : "Mixed"}</span>
        ) : null}
      </div>
    </div>
  );
}

export function LocationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { connected, loading } = useGoogleConnected();
  const locations = useLocations();
  const { color } = useLocationColors();
  const discover = useDiscoverLocations();

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  const list = locations.data?.data ?? [];

  const find = () => {
    if (discover.isPending) return;
    discover.mutate(undefined, {
      onSuccess: (r) => {
        if (r.error) return toast(r.error);
        const n = r.added.length + r.restored.length;
        toast(n ? `Found ${n} new location${n === 1 ? "" : "s"}` : "No new locations found");
      },
      onError: (err) => toast(errorMessage(err)),
    });
  };

  return (
    <div className="gb-locations">
      {locations.error ? <Notice tone="error">{errorMessage(locations.error)}</Notice> : null}
      <div className="gb-card gb-locations-card">
        <div className="gb-locations-head gb-desk">
          <span>Location</span>
          <span>Rating</span>
          <span>Reviews</span>
          <span>Waiting</span>
          <span>Replies</span>
        </div>
        {locations.isPending ? (
          [0, 1].map((i) => (
            <div key={i} className="gb-locations-row">
              <div className="gb-locations-who">
                <Skel h={36} w={36} r={9} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skel h={14} w="60%" />
                  <Skel h={12} w="40%" />
                </div>
              </div>
              <Skel h={24} w={64} r={12} />
            </div>
          ))
        ) : !list.length && !locations.error ? (
          <div className="gb-locations-empty">
            <span className="gb-title">No locations yet</span>
            <span className="gb-sub">
              This Google account doesn’t manage a Business Profile yet. Find one on Google or
              create a new profile.
            </span>
          </div>
        ) : (
          list.map((l) => <Row key={l.id} l={l} color={color(l.id)} />)
        )}
        <button
          type="button"
          className="gb-locations-add"
          disabled={discover.isPending}
          onClick={find}
        >
          <span aria-hidden style={{ fontSize: 16 }}>
            +
          </span>
          {discover.isPending ? "Looking on Google…" : "Find more locations"}
        </button>
      </div>
      <p className="gb-locations-foot">
        Not on Google yet?{" "}
        <Link href="/business/create" className="gb-link">
          Create a new profile
        </Link>
      </p>
    </div>
  );
}
