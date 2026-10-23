import type { Metadata } from "next";

import { replylySerif } from "@/features/replyly/font";
import { SetupShell } from "@/features/replyly/shell";

import "@/features/replyly/replyly.css";

export const metadata: Metadata = {
  title: { default: "Play Reviews · TreeVook AI", template: "%s · Play Reviews · TreeVook AI" },
};

export default function ReplylySetupLayout({ children }: { children: React.ReactNode }) {
  return <SetupShell fontClass={replylySerif.variable}>{children}</SetupShell>;
}
