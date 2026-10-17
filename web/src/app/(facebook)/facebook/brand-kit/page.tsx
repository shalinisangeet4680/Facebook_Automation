import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandKitPage } from "@/features/autopost/brand-kit-page";

export const metadata: Metadata = { title: "Brand kit" };

export default function Page() {
  return (
    <Suspense>
      <BrandKitPage platform="facebook" />
    </Suspense>
  );
}
