import type { Metadata } from "next";
import { Suspense } from "react";

import { LocationsPage } from "@/features/business/locations-page";

export const metadata: Metadata = { title: "Locations" };

export default function Page() {
  return (
    <Suspense>
      <LocationsPage />
    </Suspense>
  );
}
