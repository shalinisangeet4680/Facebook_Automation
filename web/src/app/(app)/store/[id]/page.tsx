import type { Metadata } from "next";
import { Suspense } from "react";

import { StoreProjectView } from "@/features/store/store-project";

export const metadata: Metadata = { title: "Play Store project" };

export default function Page() {
  return (
    <Suspense>
      <StoreProjectView />
    </Suspense>
  );
}
