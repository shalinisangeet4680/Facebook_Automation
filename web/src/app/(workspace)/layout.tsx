import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { WorkspaceShell } from "@/features/workspace/shell";

import "@/features/replyly/replyly.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: { default: "TreeVook AI", template: "%s · TreeVook AI" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell fontClass={serif.variable}>{children}</WorkspaceShell>;
}
