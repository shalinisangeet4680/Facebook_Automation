import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { MetaAdsShell } from "@/features/meta-ads/shell";

import "@/features/replyly/replyly.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: {
    default: "Meta Ads · TreeVook AI",
    template: "%s · Meta Ads · TreeVook AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MetaAdsShell fontClass={serif.variable}>{children}</MetaAdsShell>;
}
