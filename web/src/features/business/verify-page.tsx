"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { errorMessage } from "@/lib/api/errors";
import { useLocation } from "@/lib/api/business";

import "./location.css";
import { Notice } from "./ui";
import { VerifyPanel } from "./verify-panel";

export function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation(id);
  return (
    <div className="gb-lp gb-narrow">
      <h1 className="sr-only">Verify on Google</h1>
      <Link href={`/business/${id}`} className="gb-link gb-lp-back">
        ← {location.data?.title ?? "Location"}
      </Link>
      {location.error ? (
        <Notice tone="error">{errorMessage(location.error)}</Notice>
      ) : (
        <VerifyPanel locationId={id} />
      )}
    </div>
  );
}
