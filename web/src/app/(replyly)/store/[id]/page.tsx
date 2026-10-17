import type { Metadata } from "next";
import { Suspense } from "react";

import { StoreProjectView } from "@/features/store/store-project";

export const metadata: Metadata = { title: "Store listing project" };

export default function Page() {
  return (
    <Suspense>
      <StoreProjectView />
    </Suspense>
  );
}
