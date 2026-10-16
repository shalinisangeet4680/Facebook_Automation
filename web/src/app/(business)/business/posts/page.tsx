import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessPostsPage } from "@/features/business/posts-page";

export const metadata: Metadata = { title: "Posts" };

export default function Page() {
  return (
    <Suspense>
      <BusinessPostsPage />
    </Suspense>
  );
}
