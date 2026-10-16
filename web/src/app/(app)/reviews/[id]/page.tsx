import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewAppView } from "@/features/reviews/app-page";

export const metadata: Metadata = { title: "Review replies" };

export default function Page() {
  return (
    <Suspense>
      <ReviewAppView />
    </Suspense>
  );
}
