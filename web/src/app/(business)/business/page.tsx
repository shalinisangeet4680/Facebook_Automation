import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessDashboardPage } from "@/features/business/dashboard-page";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Suspense>
      <BusinessDashboardPage />
    </Suspense>
  );
}
