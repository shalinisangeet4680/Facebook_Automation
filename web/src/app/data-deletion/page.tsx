import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { DELETION_SECTIONS, DELETION_SUMMARY } from "@/features/legal/data-deletion";

import "@/features/landing/landing.css";

export const metadata: Metadata = {
  alternates: { canonical: "/data-deletion" },
  title: { absolute: "Data deletion · TreeVook AI" },
  description: "Data deletion for TreeVook AI by TreeVook LLP.",
};

export default function Page() {
  return (
    <LegalPage title="Data deletion" summary={DELETION_SUMMARY} sections={DELETION_SECTIONS} />
  );
}
