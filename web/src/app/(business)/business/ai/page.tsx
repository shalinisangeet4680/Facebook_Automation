import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessAiPage } from "@/features/business/ai-page";

export const metadata: Metadata = { title: "AI assistants" };

export default function Page() {
  return (
    <Suspense>
      <BusinessAiPage />
    </Suspense>
  );
}
