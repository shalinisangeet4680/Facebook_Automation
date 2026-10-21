import type { Metadata } from "next";

import { ConnectPage } from "@/features/replyly/connect-page";

export const metadata: Metadata = { title: "Connect Google Play" };

export default function Page() {
  return <ConnectPage />;
}
