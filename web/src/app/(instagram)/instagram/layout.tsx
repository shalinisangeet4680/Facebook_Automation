import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { AutopostShell } from "@/features/autopost/shell";

import "@/features/replyly/replyly.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: {
    default: "Instagram Autopost · TreeVook AI",
    template: "%s · Instagram Autopost · TreeVook AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AutopostShell platform="instagram" fontClass={serif.variable}>
      {children}
    </AutopostShell>
  );
}
