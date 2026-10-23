"use client";

import Image from "next/image";

import { type GbpPhoto, useLocationPhotos } from "@/lib/api/business";
import { errorMessage } from "@/lib/api/errors";
import { Banner, Skel } from "@/features/replyly/ui";

const MUTED = "#6C6962";

const LABELS: Record<GbpPhoto["category"], string> = {
  COVER: "Cover",
  PROFILE: "Profile",
  LOGO: "Logo",
  EXTERIOR: "Exterior",
  INTERIOR: "Interior",
  PRODUCT: "Product",
  AT_WORK: "At work",
  FOOD_AND_DRINK: "Food & drink",
  MENU: "Menu",
  COMMON_AREA: "Common area",
  ROOMS: "Rooms",
  TEAMS: "Team",
  ADDITIONAL: "Other",
};

export function logoOf(photos: GbpPhoto[] | undefined) {
  return (
    photos?.find((p) => p.category === "LOGO") ?? photos?.find((p) => p.category === "PROFILE")
  );
}

export function PhotosPanel({
  locationId,
  mapsUri,
}: {
  locationId: string;
  mapsUri: string | null;
}) {
  const photos = useLocationPhotos(locationId);
  if (photos.isPending)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
          gap: 14,
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skel key={i} h={150} r={12} />
        ))}
      </div>
    );
  if (photos.error) return <Banner tone="error">{errorMessage(photos.error)}</Banner>;
  const { photos: list, error } = photos.data;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? (
        <Banner tone="error" title="Photos couldn’t be loaded from Google">
          {error}
        </Banner>
      ) : null}
      <span style={{ fontSize: 13, color: MUTED }}>
        Photos you’ve added to this profile on Google.{" "}
        {mapsUri ? (
          <a
            href={mapsUri}
            target="_blank"
            rel="noreferrer"
            className="rp-btn-text"
            style={{ whiteSpace: "nowrap" }}
          >
            View on Maps ↗
          </a>
        ) : null}
      </span>
      {list.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
            gap: 14,
          }}
        >
          {list.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="rp-card"
              style={{
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <Image
                unoptimized
                src={p.thumbnailUrl}
                alt={LABELS[p.category]}
                width={360}
                height={240}
                referrerPolicy="no-referrer"
                style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
              />
              <span
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 12px",
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 500 }}>{LABELS[p.category]}</span>
                {p.views !== null ? (
                  <span style={{ color: MUTED }}>{p.views.toLocaleString()} views</span>
                ) : null}
              </span>
            </a>
          ))}
        </div>
      ) : !error ? (
        <div className="rp-card" style={{ padding: 24, color: MUTED, fontSize: 13.5 }}>
          This profile has no photos on Google yet.
        </div>
      ) : null}
    </div>
  );
}
