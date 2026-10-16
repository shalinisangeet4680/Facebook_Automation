import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessTemplatesPage } from "@/features/business/templates-page";

export const metadata: Metadata = { title: "Templates" };

export default function Page() {
  return (
    <Suspense>
      <BusinessTemplatesPage />
    </Suspense>
  );
}
