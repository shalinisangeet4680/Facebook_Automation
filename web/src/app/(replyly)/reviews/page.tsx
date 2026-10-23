import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewsHome } from "@/features/replyly/home-page";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Suspense>
      <ReviewsHome />
    </Suspense>
  );
}
