import type { Metadata } from "next";
import { Suspense } from "react";

import { AppPage } from "@/features/replyly/app-page";

export const metadata: Metadata = { title: "App" };

export default function Page() {
  return (
    <Suspense>
      <AppPage />
    </Suspense>
  );
}
