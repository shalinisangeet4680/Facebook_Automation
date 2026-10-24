import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessAccountPage } from "@/features/business/account-page";

export const metadata: Metadata = { title: "Google account" };

export default function Page() {
  return (
    <Suspense>
      <BusinessAccountPage />
    </Suspense>
  );
}
