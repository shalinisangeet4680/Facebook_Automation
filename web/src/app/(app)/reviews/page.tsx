import type { Metadata } from "next";

import { ReviewApps } from "@/features/reviews/apps-page";

export const metadata: Metadata = { title: "Review replies" };

export default function Page() {
  return <ReviewApps />;
}
