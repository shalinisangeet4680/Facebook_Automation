import type { Metadata } from "next";

import { StatesPage } from "@/features/replyly/states-page";

export const metadata: Metadata = { title: "System states" };

export default function Page() {
  return <StatesPage />;
}
