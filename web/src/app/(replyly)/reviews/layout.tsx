import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { ReplylyShell } from "@/features/replyly/shell";

import "@/features/replyly/replyly.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = { title: { default: "Replyly", template: "%s · Replyly" } };

export default function ReplylyLayout({ children }: { children: React.ReactNode }) {
  return <ReplylyShell fontClass={serif.variable}>{children}</ReplylyShell>;
}
