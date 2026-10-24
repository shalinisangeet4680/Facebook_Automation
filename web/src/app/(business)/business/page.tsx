import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessHomePage } from "@/features/business/home-page";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return (
    <Suspense>
      <BusinessHomePage />
    </Suspense>
  );
}
