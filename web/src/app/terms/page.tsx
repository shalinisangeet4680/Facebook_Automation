import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { TERMS_SECTIONS, TERMS_SUMMARY } from "@/features/legal/terms";

import "@/features/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "Terms of Service · TreeVook AI" },
  description: "Terms of Service for TreeVook AI by TreeVook LLP.",
};

export default function Page() {
  return <LegalPage title="Terms of Service" summary={TERMS_SUMMARY} sections={TERMS_SECTIONS} />;
}
