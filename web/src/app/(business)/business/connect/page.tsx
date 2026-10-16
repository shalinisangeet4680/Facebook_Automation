import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessConnectPage } from "@/features/business/connect-page";

export const metadata: Metadata = { title: "Google account" };

export default function Page() {
  return (
    <Suspense>
      <BusinessConnectPage />
    </Suspense>
  );
}
