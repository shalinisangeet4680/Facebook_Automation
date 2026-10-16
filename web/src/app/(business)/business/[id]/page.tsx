import type { Metadata } from "next";
import { Suspense } from "react";

import { LocationPage } from "@/features/business/location-page";

export const metadata: Metadata = { title: "Location" };

export default function Page() {
  return (
    <Suspense>
      <LocationPage />
    </Suspense>
  );
}
