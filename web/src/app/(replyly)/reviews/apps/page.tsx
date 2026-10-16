import type { Metadata } from "next";

import { AppsPage } from "@/features/replyly/apps-page";

export const metadata: Metadata = { title: "Apps" };

export default function Page() {
  return <AppsPage />;
}
