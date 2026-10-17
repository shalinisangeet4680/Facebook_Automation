import type { Metadata } from "next";
import { Suspense } from "react";

import { ReleasesPage } from "@/features/replyly/releases-page";

export const metadata: Metadata = { title: "Releases" };

export default function Page() {
  return (
    <Suspense>
      <ReleasesPage />
    </Suspense>
  );
}
