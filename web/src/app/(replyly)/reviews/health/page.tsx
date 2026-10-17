import type { Metadata } from "next";
import { Suspense } from "react";

import { HealthPage } from "@/features/replyly/health-page";

export const metadata: Metadata = { title: "Health" };

export default function Page() {
  return (
    <Suspense>
      <HealthPage />
    </Suspense>
  );
}
