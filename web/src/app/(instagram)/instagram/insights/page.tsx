import type { Metadata } from "next";
import { Suspense } from "react";

import { InsightsPage } from "@/features/autopost/insights-page";

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return (
    <Suspense>
      <InsightsPage platform="instagram" />
    </Suspense>
  );
}
