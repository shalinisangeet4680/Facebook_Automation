import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { REFUND_SECTIONS, REFUND_SUMMARY } from "@/features/legal/refunds";

import "@/features/landing/landing.css";

export const metadata: Metadata = {
  alternates: { canonical: "/refund-policy" },
  title: { absolute: "Cancellation & Refund Policy · TreeVook AI" },
  description: "Cancellation and refund policy for TreeVook AI by TreeVook LLP.",
};

export default function Page() {
  return (
    <LegalPage
      title="Cancellation & Refund Policy"
      summary={REFUND_SUMMARY}
      sections={REFUND_SECTIONS}
    />
  );
}
