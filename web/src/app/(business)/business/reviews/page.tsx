import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessReviewsPage } from "@/features/business/reviews-page";

export const metadata: Metadata = { title: "Reviews" };

export default function Page() {
  return (
    <Suspense>
      <BusinessReviewsPage />
    </Suspense>
  );
}
