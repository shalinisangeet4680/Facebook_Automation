import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { BusinessShell } from "@/features/business/shell";

import "@/features/replyly/replyly.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: {
    default: "Google Business · TreeVook AI",
    template: "%s · Google Business · TreeVook AI",
  },
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <BusinessShell fontClass={serif.variable}>{children}</BusinessShell>;
}
