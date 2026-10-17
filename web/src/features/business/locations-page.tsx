"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useLocations, useSyncAllLocations } from "@/lib/api/business";
import { ago, MODE_LABEL, MODE_STYLE } from "@/features/replyly/tokens";
import { Banner, PageHead, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { LocationTile } from "./location-tile";
import { useGoogleConnected, useLocationColors } from "./shell";

const MUTED = "#6C6962";

export function LocationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { connected, loading } = useGoogleConnected();
  const locations = useLocations();
  const { color } = useLocationColors();
  const sync = useSyncAllLocations();

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  const list = locations.data?.data ?? [];

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Locations"
        sub={`${list.length} location${list.length === 1 ? "" : "s"} on Google. New reviews sync every 30 minutes.`}
        actions={
          <>
            <Link href="/business/create" className="rp-btn" style={{ padding: "8px 14px" }}>
              Create a profile
            </Link>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "8px 14px" }}
              disabled={sync.isPending}
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (r) =>
                    toast(
                      r.error
                        ? r.error
                        : `Synced ${r.synced} location${r.synced === 1 ? "" : "s"}${r.added + r.restored ? ` · ${r.added + r.restored} new` : ""}`,
                    ),
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {sync.isPending ? <Spinner size={11} dark /> : null}
              Sync now
            </button>
          </>
        }
      />
      {locations.error ? <Banner tone="error">{errorMessage(locations.error)}</Banner> : null}
      {locations.isPending ? (
        <Skel h={200} />
      ) : !list.length ? (
        <div
          className="rp-card"
          style={{
            padding: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>No locations yet</span>
          <span style={{ fontSize: 13.5, color: MUTED, maxWidth: 560 }}>
            This Google account doesn’t manage a Business Profile yet. Create one here, or claim
            your business if it’s already on Google Maps.
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/business/create" className="rp-btn" style={{ padding: "9px 16px" }}>
              Create a Business Profile
            </Link>
            <Link href="/business/connect" className="rp-btn-light" style={{ padding: "9px 16px" }}>
              Use another Google account
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))",
            gap: 16,
          }}
        >
          {list.map((l) => {
            const label = MODE_LABEL[l.mode];
            const [bg, fg] = l.verified
              ? (MODE_STYLE[label] ?? ["#EFEDE8", "#55534E"])
              : ["#FBF3E2", "#8A5A00"];
            return (
              <Link
                key={l.id}
                href={`/business/${l.id}`}
                className="rp-card rp-row"
                style={{
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  color: "#191917",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <LocationTile color={color(l.id)} />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.title}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: MUTED,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {[l.category, l.address].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: bg,
                      color: fg,
                      fontSize: 11.5,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.verified ? label : "Unverified"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {[
                    ["Rating", l.rating === null ? "—" : `${l.rating.toFixed(1)}★`],
                    ["Reviews", l.totalReviews.toLocaleString()],
                    ["Needs reply", l.needsReply.toLocaleString()],
                  ].map(([k, v]) => (
                    <span key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 11.5, color: MUTED }}>{k}</span>
                      <span className="rp-mono" style={{ fontSize: 18 }}>
                        {v}
                      </span>
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: l.syncError ? "#B42318" : MUTED }}>
                  {l.syncError ??
                    (l.pauseReason ? "Safety pause is on" : `Synced ${ago(l.lastSyncedAt)}`)}
                  {!l.verified
                    ? l.verificationState === "pending"
                      ? " · Waiting for your Google code"
                      : " · Finish verification on Google"
                    : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
