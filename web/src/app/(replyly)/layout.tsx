import type { Metadata } from "next";

import { replylySerif } from "@/features/replyly/font";
import { ReplylyShell } from "@/features/replyly/shell";

import "@/features/replyly/replyly.css";

export const metadata: Metadata = {
  title: { default: "Play Reviews · TreeVook AI", template: "%s · Play Reviews · TreeVook AI" },
};

export default function ReplylyLayout({ children }: { children: React.ReactNode }) {
  return <ReplylyShell fontClass={replylySerif.variable}>{children}</ReplylyShell>;
}
