import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessMediaPage } from "@/features/business/media-page";

export const metadata: Metadata = { title: "Media" };

export default function Page() {
  return (
    <Suspense>
      <BusinessMediaPage />
    </Suspense>
  );
}
