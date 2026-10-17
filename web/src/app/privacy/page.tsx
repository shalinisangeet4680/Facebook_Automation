import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { PRIVACY_SECTIONS, PRIVACY_SUMMARY } from "@/features/legal/privacy";

import "@/features/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy · TreeVook AI" },
  description: "Privacy Policy for TreeVook AI by TreeVook LLP.",
};

export default function Page() {
  return <LegalPage title="Privacy Policy" summary={PRIVACY_SUMMARY} sections={PRIVACY_SECTIONS} />;
}
