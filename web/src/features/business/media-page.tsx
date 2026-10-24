"use client";

import Link from "next/link";

import { MediaGallery } from "./media";
import { useGoogleConnected, useLocationFilter } from "./shell";

export function BusinessMediaPage() {
  const { locationId } = useLocationFilter();
  const { connected, loading } = useGoogleConnected();
  if (!loading && !connected)
    return (
      <div className="gb-card gb-card-pad gb-empty">
        <span className="gb-title">Connect Google to see your photos and videos</span>
        <Link href="/business/connect" className="gb-btn gb-btn-dark">
          Connect Google
        </Link>
      </div>
    );
  return (
    <>
      <h1 className="sr-only">Media</h1>
      <MediaGallery locationId={locationId} />
    </>
  );
}
