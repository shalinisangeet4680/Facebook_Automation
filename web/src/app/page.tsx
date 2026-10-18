import type { Metadata } from "next";

import { LandingPage } from "@/features/landing/landing-page";
import { JsonLd, SITE_LD } from "@/features/seo/json-ld";

import "@/features/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "TreeVook AI · Reviews, posts and ads, handled" },
  description:
    "AI replies to your Google and Play reviews, posts offers to your Google profile and runs Facebook and Instagram ads. You approve what matters.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <JsonLd data={SITE_LD} />
      <LandingPage />
    </>
  );
}
