"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { errorMessage } from "@/lib/api/errors";
import { useLocation } from "@/lib/api/business";
import { Banner, PageHead } from "@/features/replyly/ui";

import { VerifyPanel } from "./verify-panel";

export function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation(id);
  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 860 }}
    >
      <Link
        href={`/business/${id}`}
        className="rp-btn-quiet"
        style={{ alignSelf: "flex-start", textDecoration: "none" }}
      >
        ← {location.data?.title ?? "Location"}
      </Link>
      <PageHead
        title="Verify on Google"
        sub="Google shows a profile, its replies and posts once you prove you run the business."
      />
      {location.error ? (
        <Banner tone="error">{errorMessage(location.error)}</Banner>
      ) : (
        <VerifyPanel locationId={id} />
      )}
    </div>
  );
}
