import type { Metadata } from "next";

import { LandingPage } from "@/features/landing/landing-page";
import { JsonLd, SITE_LD } from "@/features/seo/json-ld";
import { pageMeta } from "@/features/seo/meta";

import "@/features/landing/landing.css";

export const metadata: Metadata = pageMeta("home", "/");

export default function Home() {
  return (
    <>
      <JsonLd data={SITE_LD} />
      <LandingPage />
    </>
  );
}
