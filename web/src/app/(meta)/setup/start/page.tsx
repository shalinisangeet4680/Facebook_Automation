import type { Metadata } from "next";
import { Suspense } from "react";

import { SetupFlow } from "@/features/onboarding/setup-flow";

export const metadata: Metadata = { title: "Get set up" };

export default function Page() {
  return (
    <Suspense>
      <SetupFlow />
    </Suspense>
  );
}
