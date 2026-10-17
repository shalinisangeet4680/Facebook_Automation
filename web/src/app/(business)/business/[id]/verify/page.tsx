import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyPage } from "@/features/business/verify-page";

export const metadata: Metadata = { title: "Verify" };

export default function Page() {
  return (
    <Suspense>
      <VerifyPage />
    </Suspense>
  );
}
